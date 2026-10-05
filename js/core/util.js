/* =====================================================================
   PRIMEVAL FISHING — UTILIDADES
   Ruido de valor determinista, interpolaciones y RNG con semilla.
   Sin dependencias. Debe cargarse antes que cualquier otro script del juego.
   ===================================================================== */
window.PF = window.PF || {};

PF.Util = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Hash 2D -> [0,1)
  function hash(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  // Ruido de valor suavizado
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
  }

  function fbm(x, y, oct) {
    var s = 0, a = 0.5, f = 1;
    for (var i = 0; i < (oct || 4); i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; }
    return s;
  }

  // RNG con semilla (mulberry32) para que la vegetación sea estable
  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(entries) {
    // entries: [{w, v}]
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += entries[i].w;
    var r = Math.random() * total;
    for (var j = 0; j < entries.length; j++) {
      r -= entries[j].w;
      if (r <= 0) return entries[j].v;
    }
    return entries.length ? entries[entries.length - 1].v : null;
  }

  function fmtKg(kg) {
    if (kg < 1) return Math.round(kg * 1000) + ' g';
    return kg.toFixed(kg < 10 ? 2 : 1) + ' kg';
  }

  function isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  return { clamp: clamp, lerp: lerp, smooth: smooth, hash: hash, noise: noise, fbm: fbm, rng: rng, pickWeighted: pickWeighted, fmtKg: fmtKg, isTouch: isTouch };
})();
