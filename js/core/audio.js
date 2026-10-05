/* =====================================================================
   PRIMEVAL FISHING — AUDIO
   ---------------------------------------------------------------------
   v0.2: todo con samples (se eliminaron los osciladores procedurales).
   - SFX cortos: Web Audio (AudioBuffer) con variación de pitch.
   - Bucles continuos (carrete, freno, ambiente, olas): AudioBufferSource
     en loop con ganancia/pitch controlados por el juego.
   - Música: assets/audio/music_theme.mp3 (tema de Fishing Planet, aportado
     por el usuario) en un <audio> HTML en streaming (no se decodifica
     entero en memoria, importante en móvil). Se "agacha" (ducking) durante
     el combate para que se oigan carrete y freno.
   - Respaldo file://: si fetch falla, los SFX se reproducen con <audio>.
   Archivos: ver docs/DESIGN_DECISIONS.md §Audio.
   ===================================================================== */
window.PF = window.PF || {};

PF.Audio = (function () {
  var ctx = null, master, sfxBus, ambBus;
  var buffers = {};
  var FILES = {
    ui: 'sfx_ui_click', cast: 'sfx_cast_whoosh', plop: 'sfx_lure_plop', bell: 'sfx_bite_bell',
    splashBig: 'sfx_fish_splash', splashSmall: 'splash_small', splashHuge: 'splash_big', snap: 'sfx_line_snap2',
    reel: 'sfx_reel_loop', drag: 'sfx_drag_loop', amb: 'sfx_amb_swamp', waves: 'waves_loop',
    step1: 'step_dirt_1', step2: 'step_dirt_2', step3: 'step_dirt_3', step4: 'step_dirt_4', stepWater: 'step_water_1', wade: 'wade'
  };
  // Alias de nombres antiguos usados en el código
  var ALIAS = { tackle: 'ui', splashLure: 'plop' };
  var loops = {};          // name -> {src, gain}
  var music = null, musicBase = 0.6, duck = 1;
  var htmlFallback = false, htmlLoops = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); if (music && music.paused) music.play().catch(function () {}); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    Object.keys(FILES).forEach(function (k) {
      fetch('assets/audio/' + FILES[k] + '.mp3').then(function (r) { return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
        .then(function (buf) {
          buffers[k] = buf;
          if (k === 'amb') startLoop('amb', ambBus, 0.55);
          if (k === 'waves') startLoop('waves', ambBus, 0.22, 0.9);
          if (k === 'reel') startLoop('reel', sfxBus, 0);
          if (k === 'drag') startLoop('drag', sfxBus, 0);
        })
        .catch(function () { htmlFallback = true; });
    });
    music = new Audio('assets/audio/music_theme.mp3');
    music.loop = true; music.preload = 'auto';
    applySettings();
    music.play().catch(function () {});
  }

  function applySettings() {
    var s = PF.Save.data.settings;
    if (ctx) { sfxBus.gain.value = s.sfx; ambBus.gain.value = s.sfx * 0.9; }
    musicBase = s.music;
    if (music) music.volume = Math.max(0, Math.min(1, musicBase * 0.55 * duck));
  }

  function startLoop(name, bus, vol, rate) {
    var src = ctx.createBufferSource();
    src.buffer = buffers[name]; src.loop = true;
    src.playbackRate.value = rate || 1;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(bus); src.start();
    loops[name] = { src: src, gain: g };
  }

  function setLoop(name, vol, rate) {
    if (htmlFallback && !loops[name]) {
      // Respaldo: <audio> en bucle con volumen
      var a = htmlLoops[name];
      if (!a && vol > 0.01) { a = htmlLoops[name] = new Audio('assets/audio/' + FILES[name] + '.mp3'); a.loop = true; a.play().catch(function () {}); }
      if (a) a.volume = Math.max(0, Math.min(1, vol * PF.Save.data.settings.sfx));
      return;
    }
    var L = loops[name];
    if (!L) return;
    L.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.04);
    if (rate) L.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.05);
  }

  function play(name, vol, rate) {
    if (!ctx) return null;
    name = ALIAS[name] || name;
    if (!buffers[name]) {
      if (htmlFallback && FILES[name]) {
        var a = new Audio('assets/audio/' + FILES[name] + '.mp3');
        a.volume = Math.max(0, Math.min(1, (vol == null ? 1 : vol) * PF.Save.data.settings.sfx));
        a.play().catch(function () {});
      }
      return null;
    }
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate || (0.94 + Math.random() * 0.12);
    var g = ctx.createGain(); g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(sfxBus); src.start();
    return src;
  }

  /* speed 0..1 = velocidad de manivela */
  function setReel(speed) { if (ctx) setLoop('reel', speed > 0.02 ? 0.25 + speed * 0.45 : 0, 0.7 + speed * 0.6); }
  /* amount 0..1 = velocidad a la que sale línea por el freno */
  function setDrag(amount) { if (ctx) setLoop('drag', amount > 0.03 ? 0.35 + Math.min(1, amount) * 0.6 : 0, 0.75 + Math.min(1, amount) * 0.5); }
  function setTension() { /* el feedback de tensión es visual + vibración; se mantiene la API */ }
  /* Ducking de la música en combate */
  function setIntensity(v) {
    duck = v > 0.4 ? 0.45 : 1;
    if (music) music.volume = Math.max(0, Math.min(1, musicBase * 0.55 * duck));
  }
  function setNight(n) { if (loops.amb) loops.amb.gain.gain.setTargetAtTime(0.45 + n * 0.35, ctx.currentTime, 1); }

  return {
    init: init, play: play, setReel: setReel, setDrag: setDrag, setTension: setTension,
    setIntensity: setIntensity, setNight: setNight, applySettings: applySettings,
    get ready() { return !!ctx; }
  };
})();
