/**
 * WordCloudArt — side panel controller.
 * Pulls text out of the active tab, counts words, and drives the canvas engine.
 */
(function () {
  var IMAGE_SIZES = {
    s:  { id: 's',  label: 'Small',       export: 600 },
    m:  { id: 'm',  label: 'Medium',      export: 800 },
    l:  { id: 'l',  label: 'Large',       export: 1200 },
    xl: { id: 'xl', label: 'Extra large', export: 1600 }
  };

  var SETTINGS_KEY = 'wordcloudart.settings';
  var RESTRICTED_URL = /^(chrome|edge|about|devtools|view-source|chrome-extension|moz-extension|chrome-search|chrome-untrusted):/i;
  var RESTRICTED_HOST = /^https?:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

  var state = {
    words: [],
    uniqueWords: [],
    lastSource: '',
    pageTitle: '',
    exportCanvas: null,
    templateId: 'circle',
    applyingTemplate: false,
    previewMode: 'cloud'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function currentTemplate() {
    return getTemplateById(state.templateId);
  }

  function currentImageSize() {
    return IMAGE_SIZES[$('imageSize').value] || IMAGE_SIZES.m;
  }

  function sourceMode() {
    var checked = document.querySelector('input[name="source"]:checked');
    return checked ? checked.value : 'auto';
  }

  function setStatus(message, type) {
    var el = $('status');
    el.textContent = message || '';
    el.className = 'status' + (type ? ' ' + type : '');
  }

  function setPreviewHintVisible(visible) {
    $('previewHint').className = visible ? 'preview-hint' : 'preview-hint is-hidden';
  }

  function setBusy(busy) {
    $('btnGenerate').disabled = busy;
    var canExport = !busy && state.words.length > 0;
    $('btnDownload').disabled = !canExport;
    $('btnCopy').disabled = !canExport;
    $('btnTable').disabled = !canExport;
  }

  // ---------------------------------------------------------------- settings

  function readSettings() {
    return {
      templateId: state.templateId,
      imageSize: $('imageSize').value,
      maxWords: $('maxWords').value,
      palette: $('palette').value,
      allowRepeat: $('allowRepeat').checked,
      keepStopwords: $('keepStopwords').checked,
      allowRotate: $('allowRotate').checked,
      excludeWords: $('excludeWords').value,
      source: sourceMode()
    };
  }

  function saveSettings() {
    var payload = {};
    payload[SETTINGS_KEY] = readSettings();
    chrome.storage.local.set(payload);
  }

  function applySettings(saved) {
    if (!saved) return;
    state.applyingTemplate = true;
    if (saved.templateId && getTemplateById(saved.templateId).id === saved.templateId) {
      state.templateId = saved.templateId;
      $('templateSelect').value = saved.templateId;
    }
    if (IMAGE_SIZES[saved.imageSize]) $('imageSize').value = saved.imageSize;
    if (saved.maxWords) $('maxWords').value = saved.maxWords;
    if (saved.palette) $('palette').value = saved.palette;
    if (typeof saved.allowRepeat === 'boolean') $('allowRepeat').checked = saved.allowRepeat;
    if (typeof saved.keepStopwords === 'boolean') $('keepStopwords').checked = saved.keepStopwords;
    if (typeof saved.allowRotate === 'boolean') $('allowRotate').checked = saved.allowRotate;
    if (typeof saved.excludeWords === 'string') $('excludeWords').value = saved.excludeWords;
    var radio = document.querySelector('input[name="source"][value="' + saved.source + '"]');
    if (radio) radio.checked = true;
    state.applyingTemplate = false;
  }

  // ------------------------------------------------------------- page access

  function getActiveTab() {
    return chrome.tabs.query({ active: true, currentWindow: true })
      .then(function (tabs) {
        if (tabs && tabs.length) return tabs[0];
        return chrome.tabs.query({ active: true, lastFocusedWindow: true })
          .then(function (fallback) { return fallback && fallback[0]; });
      });
  }

  function describeTab(tab) {
    if (!tab || !tab.url) return 'No page open';
    if (RESTRICTED_URL.test(tab.url) || RESTRICTED_HOST.test(tab.url)) {
      return 'This page is off limits to extensions';
    }
    return tab.title || tab.url;
  }

  function refreshPageLabel() {
    getActiveTab().then(function (tab) {
      state.pageTitle = (tab && tab.title) || '';
      $('pageLabel').textContent = describeTab(tab);
    }).catch(function () {
      $('pageLabel').textContent = 'No page open';
    });
  }

  function extractFromTab(tab) {
    if (!tab || tab.id == null) {
      return Promise.reject(new Error('No active tab. Open a web page first.'));
    }
    if (RESTRICTED_URL.test(tab.url || '') || RESTRICTED_HOST.test(tab.url || '')) {
      return Promise.reject(new Error(
        'Chrome blocks extensions on this page. Try a normal website.'));
    }
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/extract.js']
    }).then(function (results) {
      var result = results && results[0] && results[0].result;
      if (!result) {
        throw new Error('Could not read this page. Reload it and try again.');
      }
      if (!result.ok) {
        throw new Error(result.error || 'Could not read this page.');
      }
      return result;
    }).catch(function (error) {
      var message = (error && error.message) || String(error);
      if (/cannot be scripted|Cannot access|Extension manifest/i.test(message)) {
        throw new Error('Chrome blocks extensions on this page. Try a normal website.');
      }
      throw new Error(message);
    });
  }

  /**
   * Auto prefers what the user highlighted and falls back to the article text,
   * which mirrors how the Docs add-on treats a selection.
   */
  function pickText(extracted, mode) {
    if (mode !== 'page' && extracted.selection) {
      return { text: extracted.selection, source: 'selection' };
    }
    if (mode === 'selection') {
      return { text: '', source: 'selection_empty' };
    }
    return { text: extracted.main || '', source: extracted.mainSource || 'page' };
  }

  // ------------------------------------------------------------------ render

  /**
   * The cloud is always laid out at export resolution; the font range below
   * only sets the contrast between the largest and smallest word, because the
   * engine rescales the whole range so the words fill the canvas.
   */
  function getExportDrawOptions() {
    var preset = currentImageSize();
    var tpl = currentTemplate();
    var size = WordCloudArtEngine.canvasSizeForAspect(
      tpl.aspect || 'landscape', preset.export, preset.export);
    var n = state.words.length || 1;
    var scale = Math.min(size.width, size.height) / 1080;
    var maxFont = Math.round((tpl.shape === 'none' ? 96 : 72) * scale);
    var contrast = n >= 80 ? 5 : (n >= 40 ? 4 : 3);
    return {
      width: size.width,
      height: size.height,
      shape: tpl.shape,
      palette: $('palette').value,
      rotate: $('allowRotate').checked,
      minFont: Math.max(8, Math.round(maxFont / contrast)),
      maxFont: maxFont,
      background: '#ffffff'
    };
  }

  /**
   * Mirror the exported image into the panel canvas so the preview is the real
   * output, only smaller.
   */
  function updatePreviewFromExport() {
    var preview = $('preview');
    var source = state.exportCanvas;
    if (!preview || !source || !source.width) return;

    var cssWidth = preview.clientWidth || 360;
    var dpr = window.devicePixelRatio || 1;
    var targetW = Math.max(160, Math.round(Math.min(cssWidth * dpr, source.width)));
    var targetH = Math.max(1, Math.round(targetW * source.height / source.width));

    preview.width = targetW;
    preview.height = targetH;
    var ctx = preview.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, targetW, targetH);
  }

  function renderCloud(done) {
    if (!state.exportCanvas) {
      state.exportCanvas = document.createElement('canvas');
    }
    WordCloudArtEngine.draw(state.exportCanvas, state.words, getExportDrawOptions(),
      function (placed) {
        updatePreviewFromExport();
        setPreviewHintVisible(false);
        if (done) done(placed || 0);
      });
  }

  function appendCell(row, text, tag, className) {
    var cell = document.createElement(tag || 'td');
    cell.textContent = text;
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
  }

  function renderWordTable() {
    var root = $('previewTable');
    root.innerHTML = '';
    if (!state.uniqueWords.length) return;

    var table = document.createElement('table');
    var head = document.createElement('thead');
    var headRow = document.createElement('tr');
    appendCell(headRow, '#', 'th', 'col-rank');
    appendCell(headRow, 'Word', 'th', 'word-cell');
    appendCell(headRow, 'Count', 'th', 'col-count');
    head.appendChild(headRow);
    table.appendChild(head);

    var body = document.createElement('tbody');
    for (var i = 0; i < state.uniqueWords.length; i++) {
      var row = document.createElement('tr');
      appendCell(row, String(i + 1), 'td', 'col-rank');
      appendCell(row, state.uniqueWords[i].word, 'td', 'word-cell');
      appendCell(row, String(state.uniqueWords[i].count), 'td', 'col-count');
      body.appendChild(row);
    }
    table.appendChild(body);
    root.appendChild(table);
    root.scrollTop = 0;
  }

  function setPreviewMode(mode) {
    var showTable = mode === 'table' && state.uniqueWords.length > 0;
    state.previewMode = showTable ? 'table' : 'cloud';
    if (showTable) renderWordTable();
    $('previewTable').className = showTable ? 'preview-table' : 'preview-table is-hidden';
    $('btnTable').textContent = showTable ? 'Cloud' : 'Table';
  }

  function fillTemplateSelect() {
    var sel = $('templateSelect');
    sel.innerHTML = '';
    for (var i = 0; i < WordCloudArtTemplates.length; i++) {
      var tpl = WordCloudArtTemplates[i];
      var opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      sel.appendChild(opt);
    }
    sel.value = state.templateId;
  }

  function applyTemplate(id) {
    var tpl = getTemplateById(id);
    state.templateId = tpl.id;
    state.applyingTemplate = true;
    $('palette').value = tpl.palette;
    $('allowRotate').checked = !!tpl.allowRotate;
    $('templateSelect').value = tpl.id;
    state.applyingTemplate = false;
    if (state.words.length) renderCloud();
  }

  // ---------------------------------------------------------------- generate

  function explainEmptyResult(text, stats, source) {
    if (source === 'selection_empty') {
      return 'Nothing selected on the page. Highlight some text, or switch to Whole page.';
    }
    if (!(text || '').trim()) {
      return 'No readable text found on this page.';
    }
    if (stats.tokenCount === 0) {
      return 'No words detected. This page may be mostly images or scripts.';
    }
    if (stats.excludeCount > 0 && stats.excluded > 0 && stats.kept === 0) {
      return 'Exclude list removed all words. Clear the Exclude field.';
    }
    if (stats.stopped > 0 && stats.kept === 0) {
      return 'Only common words found. Tick “Common”, or pick more text.';
    }
    return 'No words left after filtering. Clear exclusions or keep common words.';
  }

  function sourceNote(source) {
    if (source === 'selection') return 'from selection';
    if (source === 'article') return 'from page article';
    if (source === 'article_truncated') return 'from page article (truncated)';
    if (source === 'page_truncated') return 'from page (truncated)';
    return 'from page';
  }

  function generateFromText(text, source, done) {
    var maxWords = parseInt($('maxWords').value, 10) || 150;
    var allowRepeat = $('allowRepeat').checked;
    var stats = WordCloudArtText.buildWordCounts(text, {
      maxWords: maxWords,
      keepStopwords: $('keepStopwords').checked,
      excludeRaw: $('excludeWords').value
    });

    state.uniqueWords = stats.rows;
    state.words = allowRepeat
      ? WordCloudArtText.expandWordsToFill(stats.rows, maxWords)
      : stats.rows.slice();
    state.lastSource = source || 'page';
    setPreviewMode(state.previewMode);

    if (!state.uniqueWords.length) {
      renderCloud(function () {
        setStatus(explainEmptyResult(text, stats, source), 'error');
        if (done) done();
      });
      return;
    }

    setStatus('Drawing word cloud…');
    renderCloud(function (placedCount) {
      var fillNote = allowRepeat
        ? ('Placed ' + placedCount + '/' + state.words.length +
           ' (' + state.uniqueWords.length + ' unique)')
        : ('Placed ' + placedCount + '/' + state.words.length + ' unique');
      setStatus(fillNote + ' ' + sourceNote(state.lastSource) + ' · ' +
        currentTemplate().name + '.', 'ok');
      if (done) done();
    });
  }

  function generate() {
    setBusy(true);
    setStatus('Reading the page…');
    getActiveTab()
      .then(function (tab) {
        state.pageTitle = (tab && tab.title) || '';
        $('pageLabel').textContent = describeTab(tab);
        return extractFromTab(tab);
      })
      .then(function (extracted) {
        var picked = pickText(extracted, sourceMode());
        generateFromText(picked.text, picked.source, function () {
          setBusy(false);
        });
      })
      .catch(function (error) {
        setBusy(false);
        setStatus((error && error.message) || String(error), 'error');
      });
  }

  function regenerateIfLoaded() {
    if (state.words.length || state.uniqueWords.length) generate();
  }

  // ------------------------------------------------------------------ export

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the image.'));
      }, 'image/png');
    });
  }

  function fileName() {
    var base = (state.pageTitle || 'wordcloud')
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return 'wordcloud-' + (base || 'page') + '.png';
  }

  function downloadPng() {
    if (!state.exportCanvas) {
      setStatus('Generate a word cloud first.', 'error');
      return;
    }
    canvasToBlob(state.exportCanvas).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      setStatus('Saved ' + currentImageSize().label.toLowerCase() + ' PNG.', 'ok');
    }).catch(function (error) {
      setStatus((error && error.message) || String(error), 'error');
    });
  }

  function copyPng() {
    if (!state.exportCanvas) {
      setStatus('Generate a word cloud first.', 'error');
      return;
    }
    canvasToBlob(state.exportCanvas).then(function (blob) {
      return navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    }).then(function () {
      setStatus('Image copied. Paste it anywhere.', 'ok');
    }).catch(function () {
      setStatus('Copy failed. Click inside the panel first, or use Download.', 'error');
    });
  }

  function toggleWordTable() {
    if (!state.uniqueWords.length) {
      setStatus('Generate a word cloud first.', 'error');
      return;
    }
    if (state.previewMode === 'table') {
      setPreviewMode('cloud');
      setStatus('Showing the word cloud preview.');
    } else {
      setPreviewMode('table');
      setStatus(state.uniqueWords.length + ' words by frequency.');
    }
  }

  // -------------------------------------------------------------------- wire

  function wire() {
    $('templateSelect').addEventListener('change', function () {
      if (state.applyingTemplate) return;
      applyTemplate(this.value);
      saveSettings();
    });
    $('palette').addEventListener('change', function () {
      if (state.applyingTemplate) return;
      if (state.words.length) renderCloud();
      saveSettings();
    });
    $('allowRotate').addEventListener('change', function () {
      if (state.applyingTemplate) return;
      if (state.words.length) renderCloud();
      saveSettings();
    });
    $('imageSize').addEventListener('change', function () {
      if (state.words.length) renderCloud();
      saveSettings();
    });
    $('allowRepeat').addEventListener('change', function () {
      regenerateIfLoaded();
      saveSettings();
    });
    $('maxWords').addEventListener('change', function () {
      if (state.applyingTemplate) return;
      regenerateIfLoaded();
      saveSettings();
    });
    $('excludeWords').addEventListener('change', function () {
      regenerateIfLoaded();
      saveSettings();
    });

    var radios = document.querySelectorAll('input[name="source"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        regenerateIfLoaded();
        saveSettings();
      });
    }

    $('btnGenerate').addEventListener('click', generate);
    $('btnDownload').addEventListener('click', downloadPng);
    $('btnCopy').addEventListener('click', copyPng);
    $('btnTable').addEventListener('click', toggleWordTable);

    window.addEventListener('resize', function () {
      if (state.words.length) updatePreviewFromExport();
    });

    chrome.tabs.onActivated.addListener(refreshPageLabel);
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
      if (tab && tab.active && changeInfo.title) refreshPageLabel();
    });
  }

  function init() {
    fillTemplateSelect();
    wire();
    chrome.storage.local.get(SETTINGS_KEY, function (stored) {
      applySettings(stored && stored[SETTINGS_KEY]);
      refreshPageLabel();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
