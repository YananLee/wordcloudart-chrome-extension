/**
 * WordCloudArt — page text extraction.
 *
 * Injected on demand by the side panel. Everything lives inside one IIFE so a
 * repeated injection cannot clash with previous declarations, and the object
 * it evaluates to is what `chrome.scripting.executeScript` hands back.
 */
(() => {
  const MAX_CHARS = 200000;
  const MIN_PARAGRAPH_CHARS = 25;
  const MIN_CANDIDATE_CHARS = 200;
  // A short winner usually means the scoring latched onto a teaser or a card,
  // so the whole body is the safer answer.
  const MIN_MAIN_CHARS = 180;
  const NOISE_ANCESTOR_DEPTH = 6;

  const NOISE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'CANVAS',
    'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'SELECT',
    'TEXTAREA', 'INPUT', 'DIALOG', 'FIGCAPTION'
  ]);

  const NOISE_NAME = /(^|[-_ ])(nav|navbar|menu|sidebar|side-bar|footer|header|masthead|comment|comments|disqus|advert|advertisement|ads?|adsense|promo|sponsor|social|share|sharing|related|recommend|recirc|breadcrumb|pagination|paginate|cookie|consent|gdpr|popup|modal|overlay|banner|subscribe|newsletter|signup|widget|toolbar|meta|byline|tags?|toc|table-of-contents|skip-link|hidden)([-_ ]|$)/;

  const TAG_BONUS = {
    ARTICLE: 1.5,
    MAIN: 1.4,
    SECTION: 1.1,
    DIV: 1,
    UL: 0.5,
    OL: 0.5,
    LI: 0.4,
    TABLE: 0.5,
    TBODY: 0.5,
    TD: 0.4
  };

  const squash = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const clamp = (text) => (text.length > MAX_CHARS
    ? { text: text.slice(0, MAX_CHARS), truncated: true }
    : { text, truncated: false });

  function nameOf(el) {
    const cls = typeof el.className === 'string' ? el.className : '';
    return (cls + ' ' + (el.id || '')).toLowerCase();
  }

  function isNoisy(el) {
    if (NOISE_TAGS.has(el.tagName)) return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'navigation' || role === 'banner' || role === 'complementary' ||
        role === 'contentinfo' || role === 'search' || role === 'dialog') {
      return true;
    }
    return NOISE_NAME.test(nameOf(el));
  }

  function insideNoise(el) {
    let node = el;
    for (let i = 0; node && i < NOISE_ANCESTOR_DEPTH; i++) {
      if (isNoisy(node)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function isVisible(el) {
    if (!el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return !(el.offsetParent === null && style.position !== 'fixed' &&
      el.tagName !== 'BODY');
  }

  function linkDensity(el) {
    const total = (el.textContent || '').length;
    if (!total) return 1;
    let linked = 0;
    for (const a of el.querySelectorAll('a')) {
      linked += (a.textContent || '').length;
    }
    return Math.min(1, linked / total);
  }

  /**
   * Readability-style scoring: every real paragraph credits its container, and
   * a little of that credit flows up so the article wrapper — not the single
   * densest paragraph — comes out on top.
   */
  function scoreCandidates() {
    const scores = new Map();
    const add = (el, value) => {
      if (!el || el === document.body || el === document.documentElement) return;
      scores.set(el, (scores.get(el) || 0) + value);
    };

    const blocks = document.body.querySelectorAll(
      'p, li, blockquote, dd, h1, h2, h3, h4, pre, td'
    );
    for (const block of blocks) {
      if (insideNoise(block)) continue;
      const text = squash(block.textContent);
      if (text.length < MIN_PARAGRAPH_CHARS) continue;

      const punctuation = (text.match(/[,.;:!?，。；：！？、]/g) || []).length;
      const score = 1 + Math.min(text.length / 100, 3) + Math.min(punctuation * 0.2, 3);

      const parent = block.parentElement;
      add(parent, score);
      add(parent && parent.parentElement, score / 2);
      add(parent && parent.parentElement && parent.parentElement.parentElement, score / 4);
    }
    return scores;
  }

  function pickMainElement() {
    const scores = scoreCandidates();
    let best = null;
    let bestScore = 0;

    for (const [el, score] of scores) {
      if ((el.textContent || '').length < MIN_CANDIDATE_CHARS) continue;
      if (insideNoise(el) || !isVisible(el)) continue;
      const bonus = TAG_BONUS[el.tagName] != null ? TAG_BONUS[el.tagName] : 0.8;
      const final = score * bonus * (1 - linkDensity(el));
      if (final > bestScore) {
        bestScore = final;
        best = el;
      }
    }

    if (best) return best;
    return document.querySelector('article, main, [role="main"]') || document.body;
  }

  function readMain() {
    const el = pickMainElement();
    let text = squash(el.innerText || el.textContent);
    let source = el === document.body ? 'page' : 'article';
    if (text.length < MIN_MAIN_CHARS) {
      const fallback = squash(document.body.innerText || document.body.textContent);
      if (fallback.length > text.length) {
        text = fallback;
        source = 'page';
      }
    }
    return { text, source };
  }

  function readSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return '';
    return squash(selection.toString());
  }

  try {
    const selection = readSelection();
    const main = readMain();
    const clamped = clamp(main.text);
    return {
      ok: true,
      title: document.title || '',
      url: location.href,
      selection,
      main: clamped.text,
      mainSource: clamped.truncated ? main.source + '_truncated' : main.source
    };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
})();
