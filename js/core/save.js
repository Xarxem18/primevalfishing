/* =====================================================================
   PRIMEVAL FISHING — GUARDADO (localStorage, 100% offline)
   ---------------------------------------------------------------------
   Todo el progreso vive en un único objeto JSON versionado.
   Si cambias la estructura, sube SAVE_VERSION y añade una migración en
   migrate() para no romper partidas existentes.
   ===================================================================== */
window.PF = window.PF || {};

PF.Save = (function () {
  var KEY = 'primeval_fishing_save';
  var SAVE_VERSION = 2;

  function fresh() {
    return {
      version: SAVE_VERSION,
      amber: 250,           // moneda (◈ ámbar)
      xp: 0,
      level: 1,
      owned: ['rod_paleon_spin', 'reel_paleon_1000', 'line_paleon_mono4', 'leader_none', 'rig_float', 'rig_lure', 'bait_worm', 'lure_spinner'],
      baitStock: { bait_worm: 40 },
      equip: { rod: 'rod_paleon_spin', reel: 'reel_paleon_1000', line: 'line_paleon_mono4', leader: 'leader_none', rig: 'rig_float', bait: 'bait_worm' },
      floatDepth: 1.2,       // profundidad de la boya (m)
      reelSpeed: 3,          // marcha del carrete (0..4)
      lastNaturalRig: 'rig_float',
      codex: {},            // speciesId -> { count, best, firstAt }
      records: [],          // últimas capturas
      keepnet: [],          // capturas de la sesión actual (se venden al salir)
      settings: { quality: 'auto', music: 0.6, sfx: 0.9, invertY: false, sensitivity: 1.0 },
      stats: { casts: 0, catches: 0, lost: 0, snapped: 0, playTime: 0 },
      timeOfDay: 6.2        // hora inicial (amanecer)
    };
  }

  function migrate(data) {
    var base = fresh();
    // Rellenar claves nuevas sin perder las existentes
    for (var k in base) if (!(k in data)) data[k] = base[k];
    for (var s in base.settings) if (!(s in data.settings)) data.settings[s] = base.settings[s];
    for (var e in base.equip) if (!(e in data.equip)) data.equip[e] = base.equip[e];
    ['rig_float', 'rig_lure'].forEach(function (id) { if (data.owned.indexOf(id) < 0) data.owned.push(id); });
    if (PF.fixCompat) PF.fixCompat(data, 'bait');
    data.version = SAVE_VERSION;
    return data;
  }

  var state = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? migrate(JSON.parse(raw)) : fresh();
    } catch (err) {
      console.warn('[Save] datos corruptos, se crea partida nueva', err);
      state = fresh();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn('[Save] no se pudo guardar', err); }
  }

  function reset() { state = fresh(); save(); return state; }

  function xpForLevel(lv) { return Math.round(120 * Math.pow(lv, 1.55)); }

  function addXp(n) {
    state.xp += n;
    var leveled = false;
    while (state.xp >= xpForLevel(state.level)) { state.xp -= xpForLevel(state.level); state.level++; leveled = true; }
    return leveled;
  }

  return {
    load: load, save: save, reset: reset, addXp: addXp, xpForLevel: xpForLevel,
    get data() { return state; }
  };
})();
