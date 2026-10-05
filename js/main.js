/* =====================================================================
   PRIMEVAL FISHING — ARRANQUE Y BUCLE PRINCIPAL
   ---------------------------------------------------------------------
   Orden de carga (index.html): three.js -> core -> data -> world -> game
   -> main.js. Todo cuelga del namespace global PF (sin módulos ES para
   que el juego funcione abriendo index.html directamente con file://).

   Calidad adaptativa:
     - 'auto' detecta móvil/GPU débil y arranca en LOW.
     - Si los FPS medios caen < 40 durante 4 s, baja el pixelRatio.
   ===================================================================== */
window.PF = window.PF || {};

PF.Game = (function () {
  var U = PF.Util, UI = PF.UI, Input = PF.Input, A = PF.Audio;
  var renderer, scene, camera, sky, terrain, veg, player, fishing;
  var zone = null, running = false, paused = true, clock = new THREE.Clock();
  var time = 0, hour = 6.2, shakeAmt = 0;
  var TIME_SCALE = 24 / (40 * 60); // 1 día de juego = 40 min reales
  var quality = { low: false, pixelRatio: 1 };
  var fpsAcc = 0, fpsFrames = 0, fpsLowFor = 0;

  function detectQuality() {
    var s = PF.Save.data.settings.quality;
    var mobile = U.isTouch() && Math.min(screen.width, screen.height) < 900;
    if (s === 'low' || (s === 'auto' && mobile)) quality.low = true;
    else quality.low = false;
    quality.pixelRatio = Math.min(window.devicePixelRatio || 1, quality.low ? 1.25 : 2);
  }

  function initRenderer() {
    var canvas = document.getElementById('game');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !quality.low, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Salida lineal a propósito: los colores hex de las paletas se ven tal cual se escriben
    // (three r149 usa legacyMode de color; sRGB aquí "lavaría" la paleta).
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 3000);
    window.addEventListener('resize', onResize);
    Input.init(canvas);
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    checkOrientation();
  }

  function checkOrientation() {
    var portrait = window.innerHeight > window.innerWidth && U.isTouch();
    UI.show('rotate-hint', portrait);
  }

  /* Construye la escena de una zona. Para cambiar de zona se libera la
     escena anterior y se llama de nuevo (ver loadZone). */
  function buildZone(z) {
    scene = new THREE.Scene();
    scene.add(camera);
    sky = new PF.Sky(scene, z, quality);
    terrain = new PF.Terrain(scene, z, quality);
    veg = new PF.Vegetation(scene, z, quality);
    player = new PF.Player(camera, z, veg.colliders);
    fishing = new PF.Fishing({
      scene: scene, camera: camera, zone: z, terrain: terrain, ui: UI, player: player,
      paused: function () { return paused; }, time: function () { return time; }, shake: function (a) { shakeAmt = a; }
    });
    PF.Game.fishing = fishing;
  }

  function disposeScene() {
    if (!scene) return;
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); }); }
    });
    camera.children.slice().forEach(function (c) { camera.remove(c); });
  }

  function loadZone(z, spot) {
    UI.show('loading', true);
    setTimeout(function () {
      if (!zone || zone.id !== z.id) { disposeScene(); zone = z; buildZone(z); }
      fishing.refreshGear();
      fishing.resetLine();
      fishing.setRodVisible(true);
      player.teleport(spot);
      hour = PF.Save.data.timeOfDay || 6.2;
      UI.show('loading', false);
      UI.screen(null);
      UI.show('hud', true);
      document.getElementById('hud-zone').textContent = z.name + ' · ' + spot.name;
      UI.refreshTop();
      UI.dragInfo(fishing.dragPct, PF.findGear(PF.Save.data.equip.reel).drag * fishing.dragPct);
      resume();
      UI.toast(spot.desc, '');
      if (!PF.Save.data.seenHelp) { PF.Save.data.seenHelp = true; PF.Save.save(); openHelp(); }
    }, 30);
  }

  function pause() {
    if (!zone) return;
    paused = true; Input.enable(false);
    PF.Save.data.timeOfDay = hour; PF.Save.save();
    A.setReel(0); A.setDrag(0); A.setTension(0);
  }
  function resume() { paused = false; Input.enable(true); clock.getDelta(); }

  function openPause() {
    if (fishing && fishing.state === fishing.S.LANDED) return;
    pause(); UI.screen('screen-pause');
  }
  function openHelp() { pause(); UI.screen('screen-help'); }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!zone) { renderMenuBackdrop(dt); return; }
    if (!paused) {
      time += dt;
      hour = (hour + dt * TIME_SCALE * (PF.Game.fastTime ? 60 : 1)) % 24;
      PF.Save.data.stats.playTime += dt;
      Input.poll();
      player.assist = fishing.lookTarget || null;
      player.update(dt, fishing.canMove());
      fishing.update(dt, time, hour);
      UI.clock(hour);
      UI.liveHud(fishing, fishing.state);
    }
    sky.update(hour, camera.position, dt, time);
    terrain.update(time, sky);
    veg.update(time);
    A.setNight && A.ready && A.setNight(sky.night);
    if (shakeAmt > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
    }
    renderer.render(scene, camera);
    adaptQuality(dt);
  }

  /* Fondo animado del menú: se construye Wardie y se hace un paneo lento */
  var menuT = 0, menuBuilt = false;
  function renderMenuBackdrop(dt) {
    if (!menuBuilt) { buildZone(PF.ZONES[0]); menuBuilt = true; hour = 17.6; }
    menuT += dt;
    fishing.setRodVisible(false);
    camera.position.set(Math.sin(menuT * 0.03) * 30, 3.2, 14);
    camera.rotation.set(-0.04, Math.sin(menuT * 0.05) * 0.25, 0, 'YXZ');
    hour = 17.6 + Math.sin(menuT * 0.02) * 0.6;
    sky.update(hour, camera.position, dt, menuT);
    terrain.update(menuT, sky);
    veg.update(menuT);
    renderer.render(scene, camera);
    PF.Game._menuZone = PF.ZONES[0];
  }

  function adaptQuality(dt) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 1) {
      var fps = fpsFrames / fpsAcc;
      fpsAcc = 0; fpsFrames = 0;
      fpsLowFor = fps < 40 ? fpsLowFor + 1 : 0;
      if (fpsLowFor >= 4 && quality.pixelRatio > 0.75) {
        quality.pixelRatio = Math.max(0.75, quality.pixelRatio - 0.25);
        renderer.setPixelRatio(quality.pixelRatio);
        fpsLowFor = 0;
        console.info('[Calidad] pixelRatio ->', quality.pixelRatio);
      }
      var f = document.getElementById('fps');
      if (f) f.textContent = Math.round(fps) + ' fps';
    }
  }

  /* ---------- Cableado de menús ---------- */
  function wireMenus() {
    var $ = UI.$;
    $('btn-play').onclick = function () {
      A.init(); A.play('tackle', 0.4);
      UI.renderZones(function (z, s) {
        // El menú ya construyó Wardie: se reutiliza
        if (menuBuilt && !zone) zone = PF.ZONES[0];
        loadZone(z, s);
      });
      UI.screen('screen-zones');
    };
    $('btn-tackle-menu').onclick = function () { A.init(); UI.renderTackle(); UI.screen('screen-tackle'); PF.UI._back = 'screen-menu'; };
    $('btn-codex-menu').onclick = function () { A.init(); UI.renderCodex(); UI.screen('screen-codex'); PF.UI._back = 'screen-menu'; };
    $('btn-settings-menu').onclick = function () { openSettings('screen-menu'); };
    $('btn-help-menu').onclick = function () { UI.screen('screen-help'); PF.UI._back = 'screen-menu'; };
    document.querySelectorAll('.js-back').forEach(function (b) {
      b.onclick = function () {
        var back = PF.UI._back || 'screen-menu';
        PF.UI._back = null;
        if (back === 'game') { UI.screen(null); resume(); }
        else UI.screen(back);
      };
    });
    $('btn-resume').onclick = function () { UI.screen(null); resume(); };
    $('btn-tackle').onclick = function () { UI.renderTackle(); UI.screen('screen-tackle'); PF.UI._back = 'screen-pause'; };
    $('btn-codex').onclick = function () { UI.renderCodex(); UI.screen('screen-codex'); PF.UI._back = 'screen-pause'; };
    $('btn-settings').onclick = function () { openSettings('screen-pause'); };
    $('btn-help').onclick = function () { UI.screen('screen-help'); PF.UI._back = 'screen-pause'; };
    $('btn-travel').onclick = function () {
      fishing.resetLine();
      UI.renderZones(function (z, s) { loadZone(z, s); });
      UI.screen('screen-zones');
    };
    $('btn-quit').onclick = function () {
      PF.Save.data.timeOfDay = hour; PF.Save.save();
      fishing.resetLine();
      zone = null; UI.show('hud', false); UI.screen('screen-menu'); UI.refreshTop();
    };
    $('btn-help-close').onclick = function () {
      var back = PF.UI._back; PF.UI._back = null;
      if (back) UI.screen(back); else { UI.screen(null); resume(); }
    };
    Input.on('pause', openPause);
    Input.on('map', function () { openPause(); });
    Input.on('skipTime', function () { hour = (hour + 1) % 24; UI.toast('+1 hora', ''); });
    $('btn-time').onclick = function () { hour = (hour + 1) % 24; UI.toast('+1 hora → ' + Math.floor(hour) + ':00', ''); };
    document.addEventListener('visibilitychange', function () { if (document.hidden && zone && !paused) openPause(); });
  }

  function openSettings(back) {
    var s = PF.Save.data.settings, $ = UI.$;
    if (zone) pause();
    $('set-music').value = s.music; $('set-sfx').value = s.sfx; $('set-sens').value = s.sensitivity;
    $('set-quality').value = s.quality; $('set-invert').checked = s.invertY;
    var apply = function () {
      s.music = +$('set-music').value; s.sfx = +$('set-sfx').value; s.sensitivity = +$('set-sens').value;
      s.invertY = $('set-invert').checked;
      if (s.quality !== $('set-quality').value) { s.quality = $('set-quality').value; UI.toast('La calidad se aplicará al recargar', ''); }
      A.applySettings(); PF.Save.save();
    };
    ['set-music', 'set-sfx', 'set-sens', 'set-quality', 'set-invert'].forEach(function (id) { $(id).onchange = apply; $(id).oninput = apply; });
    $('btn-reset-save').onclick = function () {
      if (confirm('¿Borrar todo el progreso?')) { PF.Save.reset(); UI.refreshTop(); UI.toast('Progreso borrado', 'warn'); }
    };
    PF.UI._back = back;
    UI.screen('screen-settings');
  }

  function start() {
    PF.Save.load();
    detectQuality();
    initRenderer();
    wireMenus();
    UI.refreshTop();
    UI.screen('screen-menu');
    checkOrientation();
    UI.show('loading', false);
    loop();
    // Pantalla completa en móvil al primer toque (mejor experiencia horizontal)
    document.addEventListener('touchend', function fs() {
      var el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().then(function () {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
      }).catch(function () {});
      document.removeEventListener('touchend', fs);
    });
  }

  return { start: start, fishing: null, fastTime: false };
})();

window.addEventListener('load', PF.Game.start);
