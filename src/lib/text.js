/**
 * WordCloudArt — tokenising and word counting.
 * English words plus Chinese bigrams, with stopword and exclusion filtering.
 */
var WordCloudArtText = (function () {
  var EN_STOP = {
    a:1, about:1, above:1, after:1, again:1, against:1, all:1, am:1, an:1, and:1, any:1, are:1, as:1, at:1,
    be:1, because:1, been:1, before:1, being:1, below:1, between:1, both:1, but:1, by:1,
    can:1, did:1, do:1, does:1, doing:1, down:1, during:1,
    each:1, few:1, for:1, from:1, further:1,
    had:1, has:1, have:1, having:1, he:1, her:1, here:1, hers:1, herself:1, him:1, himself:1, his:1, how:1,
    i:1, if:1, in:1, into:1, is:1, it:1, its:1, itself:1,
    just:1,
    me:1, more:1, most:1, my:1, myself:1,
    no:1, nor:1, not:1, now:1,
    of:1, off:1, on:1, once:1, only:1, or:1, other:1, our:1, ours:1, ourselves:1, out:1, over:1, own:1,
    same:1, she:1, should:1, so:1, some:1, such:1,
    than:1, that:1, the:1, their:1, theirs:1, them:1, themselves:1, then:1, there:1, these:1, they:1, this:1, those:1, through:1, to:1, too:1,
    under:1, until:1, up:1,
    very:1,
    was:1, we:1, were:1, what:1, when:1, where:1, which:1, while:1, who:1, whom:1, why:1, will:1, with:1, would:1,
    you:1, your:1, yours:1, yourself:1, yourselves:1,
    s:1, t:1, don:1, re:1, ve:1, ll:1, d:1, m:1
  };

  function parseExcludeList(raw) {
    return (raw || '')
      .split(/[\s,，、;；]+/)
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(Boolean);
  }

  /**
   * English words + Chinese bigrams (and single CJK chars).
   */
  function tokenize(text) {
    var raw = text || '';
    var tokens = [];
    var en = raw.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g);
    if (en) {
      for (var i = 0; i < en.length; i++) tokens.push(en[i]);
    }

    var cjkRuns = raw.match(/[\u4e00-\u9fff]+/g);
    if (cjkRuns) {
      for (var r = 0; r < cjkRuns.length; r++) {
        var run = cjkRuns[r];
        if (run.length === 1) {
          tokens.push(run);
        } else {
          for (var j = 0; j < run.length - 1; j++) {
            tokens.push(run.substr(j, 2));
          }
        }
      }
    }
    return tokens;
  }

  function buildWordCounts(text, options) {
    options = options || {};
    var exclude = {};
    var custom = parseExcludeList(options.excludeRaw);
    for (var i = 0; i < custom.length; i++) {
      exclude[custom[i]] = 1;
    }

    var tokens = tokenize(text);
    var counts = {};
    var kept = 0;
    var stopped = 0;
    var excluded = 0;

    for (var t = 0; t < tokens.length; t++) {
      var word = tokens[t];
      var isCjk = /[\u4e00-\u9fff]/.test(word);
      if (!isCjk && word.length < 2) continue;
      if (!isCjk && !options.keepStopwords && EN_STOP[word]) {
        stopped += 1;
        continue;
      }
      if (exclude[word.toLowerCase()] || exclude[word]) {
        excluded += 1;
        continue;
      }
      counts[word] = (counts[word] || 0) + 1;
      kept += 1;
    }

    var rows = Object.keys(counts).map(function (w) {
      return { word: w, count: counts[w] };
    });

    rows.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.word.localeCompare(b.word);
    });

    var maxWords = Math.max(5, Math.min(500, options.maxWords || 150));
    return {
      rows: rows.slice(0, maxWords),
      tokenCount: tokens.length,
      kept: kept,
      stopped: stopped,
      excluded: excluded,
      excludeCount: custom.length
    };
  }

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Expand unique words into up to maxPlacements items, weighted by frequency.
   * Font size still uses the original count.
   */
  function expandWordsToFill(rows, maxPlacements) {
    if (!rows || !rows.length) return [];
    var limit = Math.max(1, Math.min(500, maxPlacements || 150));
    if (rows.length >= limit) {
      return rows.slice(0, limit).map(function (r) {
        return { word: r.word, count: r.count };
      });
    }

    var totalWeight = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      totalWeight += Math.max(1, rows[i].count);
    }

    var expanded = [];
    for (i = 0; i < rows.length; i++) {
      expanded.push({ word: rows[i].word, count: rows[i].count });
    }

    var remaining = limit - expanded.length;
    var floors = [];
    var used = 0;
    for (i = 0; i < rows.length; i++) {
      var exact = (Math.max(1, rows[i].count) / totalWeight) * remaining;
      var n = Math.floor(exact);
      floors.push({ index: i, n: n, frac: exact - n });
      used += n;
    }
    floors.sort(function (a, b) { return b.frac - a.frac; });
    var left = remaining - used;
    for (var k = 0; k < left; k++) {
      floors[k % floors.length].n += 1;
    }
    for (i = 0; i < floors.length; i++) {
      var row = rows[floors[i].index];
      for (var t = 0; t < floors[i].n; t++) {
        expanded.push({ word: row.word, count: row.count });
      }
    }

    return shuffleInPlace(expanded).slice(0, limit);
  }

  return {
    tokenize: tokenize,
    parseExcludeList: parseExcludeList,
    buildWordCounts: buildWordCounts,
    expandWordsToFill: expandWordsToFill
  };
})();
