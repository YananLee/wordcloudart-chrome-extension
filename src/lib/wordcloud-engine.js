/**
 * WordCloudArt engine — thin wrapper around wordcloud2.js
 * https://github.com/timdream/wordcloud2.js
 */
var WordCloudArtEngine = (function () {
  var PALETTES = {
    ocean: ['#0f766e', '#0e7490', '#0369a1', '#1d4ed8', '#334155'],
    sunset: ['#c2410c', '#b45309', '#a16207', '#9a3412', '#7c2d12'],
    forest: ['#166534', '#15803d', '#3f6212', '#365314', '#14532d'],
    mono: ['#1c1917', '#44403c', '#57534e', '#78716c', '#a8a29e'],
    berry: ['#9f1239', '#be123c', '#a21caf', '#7e22ce', '#6b21a8']
  };

  var BUILTIN_SHAPES = {
    none: 'square',
    classic: 'square',
    circle: 'circle',
    square: 'square',
    triangle: 'triangle',
    diamond: 'diamond',
    star: 'star'
  };

  // Share of the reachable area that word boxes cover in a saturated layout.
  // Below 1 because glyphs interlock and boxes overlap.
  var PACKING_DENSITY = 0.8;
  // Ceiling on how far a narrow shape may push the font size up, and the
  // share of the shape a typical word must still fit into.
  var MAX_REACH_COMPENSATION = 3;
  var MIN_REACH_RATIO = 0.35;
  var MIN_LONGEST_REACH_RATIO = 0.15;
  // Sampling step for the reachability scan; the result is a ratio, so
  // checking every other pixel is accurate enough and four times cheaper.
  var REACH_STEP = 2;
  // Reference size used to measure a word once; canvas text metrics scale
  // linearly with the font size.
  var PROBE_FONT_SIZE = 100;
  var FONT_FAMILY = '"Segoe UI", Arial, sans-serif';
  var FONT_WEIGHT = '700';

  function getPalette(name) {
    return PALETTES[name] || PALETTES.ocean;
  }

  function toRgb(color) {
    var value = String(color || '').trim();
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hex) {
      var h = hex[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [
        parseInt(h.substr(0, 2), 16),
        parseInt(h.substr(2, 2), 16),
        parseInt(h.substr(4, 2), 16)
      ];
    }
    var rgb = /^rgba?\(([^)]+)\)/i.exec(value);
    if (rgb) {
      var parts = rgb[1].split(',');
      return [
        parseInt(parts[0], 10) || 0,
        parseInt(parts[1], 10) || 0,
        parseInt(parts[2], 10) || 0
      ];
    }
    return [255, 255, 255];
  }

  /**
   * Bounding box of everything that differs from the background colour.
   * Returns null when the canvas is empty or cannot be read.
   */
  function measureContentBounds(canvas, background) {
    var width = canvas.width;
    var height = canvas.height;
    var data;
    try {
      data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    } catch (err) {
      return null;
    }

    var bg = toRgb(background);
    var tolerance = 10;
    var minX = width;
    var minY = height;
    var maxX = -1;
    var maxY = -1;

    for (var y = 0; y < height; y++) {
      var row = y * width * 4;
      for (var x = 0; x < width; x++) {
        var i = row + x * 4;
        if (data[i + 3] < 8) continue;
        if (Math.abs(data[i] - bg[0]) <= tolerance &&
            Math.abs(data[i + 1] - bg[1]) <= tolerance &&
            Math.abs(data[i + 2] - bg[2]) <= tolerance) {
          continue;
        }
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < 0) return null;
    return {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Move the drawn words to the middle of the canvas. The offset is a whole
   * number of pixels, so nothing is resampled.
   */
  function centerContent(canvas, background) {
    var bounds = measureContentBounds(canvas, background);
    if (!bounds) return;

    var width = canvas.width;
    var height = canvas.height;
    var dx = Math.round((width - bounds.width) / 2 - bounds.left);
    var dy = Math.round((height - bounds.height) / 2 - bounds.top);
    if (!dx && !dy) return;

    var buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    buffer.getContext('2d').drawImage(canvas, 0, 0);

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(buffer, dx, dy);
  }

  /**
   * Width and height of each word at PROBE_FONT_SIZE, expressed as a multiple
   * of the font size. Repeated words are measured once.
   */
  function measureWordBoxes(list, fontFamily, fontWeight) {
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = fontWeight + ' ' + PROBE_FONT_SIZE + 'px ' + fontFamily;

    var cache = {};
    var boxes = [];
    for (var i = 0; i < list.length; i++) {
      var word = String(list[i][0]);
      var box = cache[word];
      if (!box) {
        var metrics = ctx.measureText(word);
        var painted = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        if (!isFinite(painted) || painted <= 0) painted = PROBE_FONT_SIZE * 0.75;
        box = {
          w: metrics.width / PROBE_FONT_SIZE,
          h: painted / PROBE_FONT_SIZE
        };
        cache[word] = box;
      }
      boxes.push(box);
    }
    return boxes;
  }

  /**
   * Running pixel counts of the open (drawable) part of a mask, so any
   * rectangle's open area can be read in constant time.
   */
  function buildOpenAreaTable(mask, width, height) {
    var stride = width + 1;
    var sums = new Int32Array(stride * (height + 1));
    var data = mask.data;
    for (var y = 0; y < height; y++) {
      var row = (y + 1) * stride;
      var above = y * stride;
      var running = 0;
      for (var x = 0; x < width; x++) {
        if (data[(y * width + x) * 4] >= 252) running += 1;
        sums[row + x + 1] = sums[above + x + 1] + running;
      }
    }
    return sums;
  }

  /**
   * Area of a shape that a boxW by boxH word can actually be placed in.
   * The narrow extremities of a star or a heart cannot hold a word, so they
   * never receive one and the words have to pile up denser in the middle for
   * the silhouette to still reach the edge of the frame.
   */
  function reachableArea(sums, width, height, boxW, boxH) {
    var bw = Math.max(1, Math.min(width, Math.round(boxW)));
    var bh = Math.max(1, Math.min(height, Math.round(boxH)));
    var need = bw * bh;
    var stride = width + 1;
    var open = 0;
    for (var y = 0; y + bh <= height; y += REACH_STEP) {
      var top = y * stride;
      var bottom = (y + bh) * stride;
      for (var x = 0; x + bw <= width; x += REACH_STEP) {
        if (sums[bottom + x + bw] - sums[top + x + bw] -
            sums[bottom + x] + sums[top + x] === need) {
          open += 1;
        }
      }
    }
    return open * REACH_STEP * REACH_STEP;
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * Font scale that makes the words' grid footprints add up to the area they
   * can reach, so a single layout pass fills the canvas.
   *
   * A word occupies (w·s + grid) by (h·s + grid) pixels, so the total demand
   * is a·s² + b·s + c and the scale falls out of the quadratic. The area
   * budget then gets scaled up by however much of the shape a typical word
   * cannot reach.
   */
  function solveFontScale(list, boxes, sizeAt, gridSize, area, measureReach, width, height) {
    var a = 0;
    var b = 0;
    var c = 0;
    var widest = 0;
    var widestHeight = 0;
    var tallest = 0;
    var widths = [];
    var heights = [];

    for (var i = 0; i < list.length; i++) {
      var size = sizeAt(list[i][1]);
      var w = boxes[i].w * size;
      var h = boxes[i].h * size;
      a += w * h;
      b += gridSize * (w + h);
      c += gridSize * gridSize;
      widths.push(w);
      heights.push(h);
      if (w > widest) {
        widest = w;
        widestHeight = h;
      }
      if (h > tallest) tallest = h;
    }
    if (a <= 0) return 1;

    var medianW = median(widths);
    var medianH = median(heights);

    function scaleForBudget(budget) {
      var target = budget - c;
      if (target <= 0) return 0.2;
      return (-b + Math.sqrt(b * b + 4 * a * target)) / (2 * a);
    }

    function reachRatioAt(s) {
      return measureReach(medianW * s + gridSize, medianH * s + gridSize) / area;
    }

    var scale = scaleForBudget(area * PACKING_DENSITY);
    // The reachable area depends on the word size, which is what we are
    // solving for; two rounds are enough for it to settle. The compensation
    // is capped because a shape too narrow for its words would otherwise keep
    // pushing the font size up, making the words fit even worse.
    for (var round = 0; round < 2; round++) {
      var compensation = Math.min(MAX_REACH_COMPENSATION,
        1 / Math.max(0.01, Math.min(1, reachRatioAt(scale))));
      scale = scaleForBudget(area * PACKING_DENSITY * compensation);
    }

    // Words that no longer fit into the shape are shrunk one by one by
    // wordcloud2, or dropped once they hit minSize, which is both slow and
    // lossy. Back the scale off to the largest size the shape can host: the
    // typical word needs room across the shape, the longest word at least
    // needs somewhere to go.
    function fitsInShape(s) {
      if (reachRatioAt(s) < MIN_REACH_RATIO) return false;
      var longest = measureReach(widest * s + gridSize, widestHeight * s + gridSize);
      return longest >= area * MIN_LONGEST_REACH_RATIO;
    }

    if (!fitsInShape(scale)) {
      var low = 0.05;
      var high = scale;
      for (var step = 0; step < 8; step++) {
        var mid = (low + high) / 2;
        if (fitsInShape(mid)) low = mid;
        else high = mid;
      }
      scale = low;
    }

    // A word wider or taller than the canvas can never be placed, whatever
    // the area budget says.
    if (widest > 0) scale = Math.min(scale, width * 0.92 / widest);
    if (tallest > 0) scale = Math.min(scale, height * 0.92 / tallest);
    return Math.max(0.2, scale);
  }

  function canvasSizeForAspect(aspect, baseW, baseH) {
    if (aspect === 'square') {
      var side = Math.min(baseW, baseH);
      return { width: side, height: side };
    }
    if (aspect === 'portrait') {
      return { width: Math.round(baseH * 0.75), height: baseH };
    }
    return { width: baseW, height: baseH };
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function drawShapePath(ctx, width, height, shape) {
    var pad = Math.max(2, Math.min(width, height) * 0.02);
    var x0 = pad;
    var y0 = pad;
    var w = width - pad * 2;
    var h = height - pad * 2;
    var cx = width / 2;
    var cy = height / 2;

    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(cx, cy, Math.min(w, h) / 2, 0, Math.PI * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(cx, y0);
      ctx.lineTo(x0 + w, y0 + h);
      ctx.lineTo(x0, y0 + h);
      ctx.closePath();
    } else if (shape === 'diamond') {
      ctx.moveTo(cx, y0);
      ctx.lineTo(x0 + w, cy);
      ctx.lineTo(cx, y0 + h);
      ctx.lineTo(x0, cy);
      ctx.closePath();
    } else if (shape === 'star') {
      var outer = Math.min(w, h) / 2;
      for (var s = 0; s < 10; s++) {
        var sr = s % 2 === 0 ? outer : outer / 2.4;
        var sa = (Math.PI / 5) * s - Math.PI / 2;
        var sx2 = cx + sr * Math.cos(sa);
        var sy2 = cy + sr * Math.sin(sa);
        if (s === 0) ctx.moveTo(sx2, sy2);
        else ctx.lineTo(sx2, sy2);
      }
      ctx.closePath();
    } else if (shape === 'square') {
      var sq = Math.min(w, h);
      ctx.rect(cx - sq / 2, cy - sq / 2, sq, sq);
    } else if (shape === 'rounded') {
      var side = Math.min(w, h);
      var r = side * 0.18;
      var sx = cx - side / 2;
      var sy = cy - side / 2;
      ctx.moveTo(sx + r, sy);
      ctx.arcTo(sx + side, sy, sx + side, sy + side, r);
      ctx.arcTo(sx + side, sy + side, sx, sy + side, r);
      ctx.arcTo(sx, sy + side, sx, sy, r);
      ctx.arcTo(sx, sy, sx + side, sy, r);
      ctx.closePath();
    } else if (shape === 'hexagon') {
      var hr = Math.min(w, h) / 2;
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 180) * (60 * i - 30);
        var x = cx + hr * Math.cos(a);
        var y = cy + hr * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape === 'heart') {
      var s = Math.min(w, h) / 2.2;
      ctx.moveTo(cx, cy + s * 0.9);
      ctx.bezierCurveTo(cx + s * 1.6, cy - s * 0.15, cx + s * 0.85, cy - s * 1.25, cx, cy - s * 0.55);
      ctx.bezierCurveTo(cx - s * 0.85, cy - s * 1.25, cx - s * 1.6, cy - s * 0.15, cx, cy + s * 0.9);
      ctx.closePath();
    } else if (shape === 'cloud') {
      var rw = w * 0.42;
      var rh = h * 0.28;
      ctx.ellipse(cx - rw * 0.55, cy + rh * 0.15, rw * 0.55, rh * 0.85, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + rw * 0.5, cy + rh * 0.2, rw * 0.5, rh * 0.8, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy - rh * 0.35, rw * 0.7, rh, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - rw * 0.15, cy + rh * 0.35, rw * 0.75, rh * 0.75, 0, 0, Math.PI * 2);
    } else if (shape === 'arrow') {
      var shaftH = h * 0.36;
      var headW = w * 0.38;
      var midY = y0 + h / 2;
      ctx.moveTo(x0, midY - shaftH / 2);
      ctx.lineTo(x0 + w - headW, midY - shaftH / 2);
      ctx.lineTo(x0 + w - headW, y0);
      ctx.lineTo(x0 + w, midY);
      ctx.lineTo(x0 + w - headW, y0 + h);
      ctx.lineTo(x0 + w - headW, midY + shaftH / 2);
      ctx.lineTo(x0, midY + shaftH / 2);
      ctx.closePath();
    } else if (shape === 'oval') {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(x0, y0, w, h);
    }
  }

  /**
   * Every template except the free-form ones is clipped by a pixel mask.
   * wordcloud2's built-in shapes only bias the placement order, so a dense
   * cloud spreads into the corners and loses the silhouette.
   */
  function needsMask(shape) {
    return shape !== 'none' && shape !== 'classic';
  }

  function prepareMask(canvas, shape) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    // Non-background pixels become blocked; keep shape area as background white.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    drawShapePath(ctx, width, height, shape);
    ctx.fill();

    var mask = ctx.getImageData(0, 0, width, height);
    var open = 0;
    for (var i = 0; i < mask.data.length; i += 4) {
      if (mask.data[i] >= 252) open += 1;
    }
    canvas._wordCloudArtMask = mask;
    canvas._wordCloudArtMaskArea = open;
  }

  function clearMaskToWhite(canvas) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var img = ctx.getImageData(0, 0, width, height);
    var d = img.data;
    var mask = canvas._wordCloudArtMask;
    var md = mask && mask.data;
    for (var i = 0; i < d.length; i += 4) {
      // Only clear pixels that originated outside the white shape. This
      // preserves grayscale text when the Mono palette is selected.
      if (md && md[i] < 252 && md[i + 1] < 252 && md[i + 2] < 252) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas._wordCloudArtMask = null;
  }

  function shapeOption(shape, width, height) {
    if (shape === 'oval') {
      return 'circle';
    }
    if (BUILTIN_SHAPES[shape]) {
      return BUILTIN_SHAPES[shape];
    }
    if (shape === 'hexagon') {
      return function shapeHexagon(theta) {
        var thetaPrime = (theta + Math.PI / 6) % (Math.PI / 3);
        return 1 / (Math.cos(thetaPrime) + Math.SQRT3 * Math.sin(thetaPrime));
      };
    }
    return 'circle';
  }

  function ellipticityFor(shape, width, height) {
    // Keep wordcloud2's layout circular.  Shape masks define the visual
    // boundary; lowering ellipticity here compresses every template into an
    // unwanted ellipse.
    return 1;
  }

  function drawShapeThumbnail(canvas, shape, color) {
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = color || '#0f766e';
    var thumbShape = shape === 'none' || shape === 'classic' ? 'oval' : shape;
    if (BUILTIN_SHAPES[thumbShape] && thumbShape !== 'rounded') {
      // Approximate built-ins with simple paths for thumbnails
      var pad = 4;
      var cx = width / 2;
      var cy = height / 2;
      var rw = (width - pad * 2) / 2;
      var rh = (height - pad * 2) / 2;
      ctx.beginPath();
      if (thumbShape === 'circle') {
        ctx.arc(cx, cy, Math.min(rw, rh), 0, Math.PI * 2);
      } else if (thumbShape === 'square') {
        var side = Math.min(rw, rh) * 2;
        ctx.rect(cx - side / 2, cy - side / 2, side, side);
      } else if (thumbShape === 'triangle') {
        ctx.moveTo(cx, pad);
        ctx.lineTo(width - pad, height - pad);
        ctx.lineTo(pad, height - pad);
        ctx.closePath();
      } else if (thumbShape === 'diamond') {
        ctx.moveTo(cx, pad);
        ctx.lineTo(width - pad, cy);
        ctx.lineTo(cx, height - pad);
        ctx.lineTo(pad, cy);
        ctx.closePath();
      } else if (thumbShape === 'star') {
        for (var i = 0; i < 10; i++) {
          var r = i % 2 === 0 ? Math.min(rw, rh) : Math.min(rw, rh) / 2.4;
          var a = (Math.PI / 5) * i - Math.PI / 2;
          var x = cx + r * Math.cos(a);
          var y = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    } else {
      drawShapePath(ctx, width, height, thumbShape);
      ctx.fill();
    }
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{word:string,count:number}>} words
   * @param {Object} options
   * @param {function(number):void=} done callback with placed count
   */
  function draw(canvas, words, options, done) {
    options = options || {};
    if (typeof WordCloud === 'undefined') {
      if (done) done(0);
      return;
    }

    WordCloud.stop();

    var width = options.width || canvas.width;
    var height = options.height || canvas.height;
    canvas.width = width;
    canvas.height = height;

    var ctx = canvas.getContext('2d');
    var background = options.background || '#ffffff';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    if (!words || !words.length) {
      ctx.fillStyle = '#78716c';
      ctx.font = Math.max(14, Math.round(Math.min(width, height) / 22)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No words to display', width / 2, height / 2);
      if (done) done(0);
      return;
    }

    var list = [];
    var maxWeight = 1;
    for (var i = 0; i < words.length; i++) {
      var weight = Math.max(1, words[i].count || 1);
      if (weight > maxWeight) maxWeight = weight;
      list.push([String(words[i].word), weight]);
    }

    var colors = shuffle(getPalette(options.palette));
    var colorIndex = 0;
    var minFont = options.minFont || 10;
    var maxFont = options.maxFont || 64;
    var shape = options.shape || 'none';
    var useMask = needsMask(shape);

    var gridSize = Math.max(4, Math.round(Math.min(width, height) / 90));
    if (list.length >= 80) gridSize = Math.max(4, gridSize - 2);

    function baseSizeFor(weight) {
      var t = weight / maxWeight;
      return minFont + t * (maxFont - minFont);
    }

    if (useMask) {
      prepareMask(canvas, shape);
    }

    // wordcloud2 draws whatever px sizes weightFactor returns, so the scale
    // that fills the canvas has to be worked out here.
    var area = useMask ? canvas._wordCloudArtMaskArea : width * height;
    var openAreas = useMask
      ? buildOpenAreaTable(canvas._wordCloudArtMask, width, height)
      : null;

    function measureReach(boxW, boxH) {
      if (openAreas) {
        return reachableArea(openAreas, width, height, boxW, boxH);
      }
      return Math.max(0, width - boxW) * Math.max(0, height - boxH);
    }

    var fontScale = solveFontScale(
      list,
      measureWordBoxes(list, FONT_FAMILY, FONT_WEIGHT),
      baseSizeFor,
      gridSize,
      area,
      measureReach,
      width,
      height
    );

    var placed = 0;
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      canvas.removeEventListener('wordcloudstop', onStop);
      canvas.removeEventListener('wordclouddrawn', onDrawn);
      if (useMask) {
        clearMaskToWhite(canvas);
      }
      centerContent(canvas, background);
      if (done) done(placed);
    }

    function onDrawn(ev) {
      if (ev && ev.detail && ev.detail.drawn) {
        placed += 1;
      }
    }

    function onStop() {
      finish();
    }

    canvas.addEventListener('wordclouddrawn', onDrawn);
    canvas.addEventListener('wordcloudstop', onStop);

    try {
      WordCloud(canvas, {
        list: list,
        gridSize: gridSize,
        weightFactor: function (w) {
          return Math.max(1, Math.round(baseSizeFor(w) * fontScale));
        },
        fontFamily: FONT_FAMILY,
        fontWeight: FONT_WEIGHT,
        color: function () {
          var c = colors[colorIndex % colors.length];
          colorIndex += 1;
          return c;
        },
        backgroundColor: background,
        clearCanvas: !useMask,
        rotateRatio: options.rotate ? 0.35 : 0,
        minRotation: -Math.PI / 2,
        maxRotation: Math.PI / 2,
        rotationSteps: options.rotate ? 2 : 0,
        shuffle: true,
        shape: useMask ? 'circle' : shapeOption(shape, width, height),
        ellipticity: ellipticityFor(shape, width, height),
        drawOutOfBound: false,
        shrinkToFit: true,
        // Anything below this is dropped instead of drawn, so it has to stay
        // under the smallest size the layout actually asks for.
        minSize: Math.max(4, Math.floor(minFont * fontScale * 0.6)),
        wait: 0,
        abortThreshold: 2000
      });
    } catch (err) {
      finish();
    }

    // Safety timeout if events don't fire
    setTimeout(function () {
      if (!finished) finish();
    }, 8000);
  }

  function canvasToBase64Png(canvas) {
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }

  return {
    PALETTES: PALETTES,
    getPalette: getPalette,
    canvasSizeForAspect: canvasSizeForAspect,
    drawShapeThumbnail: drawShapeThumbnail,
    draw: draw,
    canvasToBase64Png: canvasToBase64Png
  };
})();
