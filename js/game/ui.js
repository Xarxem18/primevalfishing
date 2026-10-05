/* =====================================================================
   PRIMEVAL FISHING — INTERFAZ (DOM)
   ---------------------------------------------------------------------
   La UI es HTML/CSS sobre el canvas (más nítida y barata que dibujarla
   en WebGL, y accesible para editar). Estilo: "tablillas de piedra y
   cuero" con tipografía Cinzel (inscripción) + Alegreya Sans (lectura).
   Pantallas: menú, selector de zona, HUD, caja de aparejos (equipo y
   tienda), códex, panel de captura, pausa/ajustes.
   ===================================================================== */
window.PF = window.PF || {};

PF.UI = (function () {
  var U = PF.Util;
  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;

  function show(id, v) { var el = $(id); if (el) el.classList.toggle('hidden', !v); }
  function screen(id) {
    ['screen-menu', 'screen-zones', 'screen-tackle', 'screen-codex', 'screen-pause', 'screen-catch', 'screen-settings', 'screen-help'].forEach(function (s) { show(s, s === id); });
  }

  /* ---------- Barra superior ---------- */
  function refreshTop() {
    var d = PF.Save.data;
    document.querySelectorAll('.js-amber').forEach(function (e) { e.textContent = d.amber.toLocaleString('es'); });
    document.querySelectorAll('.js-level').forEach(function (e) { e.textContent = d.level; });
    var need = PF.Save.xpForLevel(d.level);
    document.querySelectorAll('.js-xpbar').forEach(function (e) { e.style.width = Math.min(100, d.xp / need * 100) + '%'; });
    var eq = d.equip, bait = PF.findGear(eq.bait);
    var g = $('hud-gear');
    if (g) {
      var stock = bait.uses != null ? ' ×' + (d.baitStock[bait.id] || 0) : '';
      g.innerHTML = '<b>' + PF.findGear(eq.rod).name + '</b><br>' + PF.findGear(eq.reel).name + '<br>' + PF.findGear(eq.line).name + ' · ' + PF.findGear(eq.leader).name + '<br>' + PF.findGear(eq.rig).name + '<br>' + bait.name + stock;
    }
  }

  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ---------- HUD de pesca ---------- */
  function castMeter(v, p) {
    show('cast-meter', v);
    if (v) {
      $('cast-fill').style.width = (p * 100) + '%';
      $('cast-label').textContent = Math.round((10 + 40 * Math.pow(p, 0.9)) * PF.findGear(PF.Save.data.equip.rod).cast) + ' m';
    }
  }
  function bite(v) {
    show('bite-alert', v);
    $('btn-action').classList.toggle('pulse', v);
  }
  function habitat(txt) { $('hud-habitat').textContent = txt; show('hud-habitat', !!txt); }
  function lineInfo(dist, depth) { $('hud-line').textContent = 'Línea ' + dist.toFixed(1) + ' m · Prof. ' + depth.toFixed(1) + ' m'; }

  function fightHud(v, sp) {
    show('fight-hud', v);
    document.body.classList.toggle('fighting', v);

  }
  function dragInfo(pct, kg) {
    $('drag-fill').style.height = (pct * 100) + '%';
    $('drag-label').textContent = kg.toFixed(1) + ' kg';
    $('drag-pct').textContent = Math.round(pct * 100) + '%';
  }
  function fightUpdate(s) {
    var t = Math.min(1.2, s.tension);
    var tf = $('tension-fill');
    tf.style.width = Math.min(100, t * 100) + '%';
    tf.className = 'tension-fill' + (t > 0.85 ? ' danger' : t > 0.6 ? ' warn' : '');
    $('tension-wrap').classList.toggle('shake', t > 0.85);
    $('stamina-fill').style.width = (s.stamina * 100) + '%';
    $('line-fill').style.width = Math.min(100, s.line / s.cap * 100) + '%';
    $('line-label').textContent = s.line.toFixed(0) + ' / ' + s.cap + ' m';
    $('drag-fill').style.height = (s.drag * 100) + '%';
    $('drag-label').textContent = s.dragKg.toFixed(1) + ' kg';
    $('drag-pct').textContent = Math.round(s.drag * 100) + '%';
    $('tension-kg').textContent = '';
    $('drag-wrap').classList.toggle('slipping', s.slipping);
    var labels = { run: 'CARRERA', rest: 'DESCANSA', thrash: 'SACUDIDAS', charge: 'HACIA TI', tired: 'AGOTADO' };
    $('fight-phase').textContent = labels[s.phase] || '';
    $('fight-phase').className = 'phase phase-' + s.phase;
  }

  /* ---------- Panel de captura ---------- */
  function showCatch(d, cb) {
    screen('screen-catch');
    var sp = d.species;
    $('catch-name').textContent = sp.name;
    $('catch-sci').textContent = sp.sci;
    $('catch-weight').textContent = U.fmtKg(d.kg);
    var c = $('catch-cat');
    c.textContent = d.cat.name + (sp.star ? ' · ★ ESTRELLA' : '');
    c.style.color = d.cat.color;
    $('catch-desc').textContent = sp.desc;
    $('catch-value').textContent = '◈ ' + d.value;
    $('catch-xp').textContent = '+' + d.xp + ' XP';
    $('catch-flags').innerHTML = (d.isNew ? '<span class="flag new">¡NUEVA ESPECIE!</span>' : '') + (d.isRecord ? '<span class="flag rec">RÉCORD PERSONAL</span>' : '');
    var done = function (keep) { screen(null); cb(keep); };
    $('btn-keep').onclick = function () { done(true); };
    $('btn-release').onclick = function () { done(false); };
  }

  /* ---------- Caja de aparejos (equipo + tienda) ---------- */
  var tackleCat = 'rod';
  function statLine(cat, it) {
    if (cat === 'rod') return it.type + ' ' + it.cls + ' · Potencia ' + it.power + ' kg · Sens. ' + Math.round(it.sens * 100) + ' · Lance ×' + it.cast;
    if (cat === 'reel') return 'Freno ' + it.drag + ' kg · Precisión ' + Math.round(it.dragPrec * 100) + ' · ' + it.speed + ' m/s · ' + it.cap + ' m';
    if (cat === 'line') return it.kind + ' ' + it.test + ' kg · Visib. ' + Math.round(it.vis * 100) + ' · Elast. ' + Math.round(it.stretch * 100);
    if (cat === 'leader') return it.kind + ' · Anti-dientes ' + Math.round(it.bite * 100) + ' · Visib. ' + Math.round(it.vis * 100);
    if (cat === 'rig') return it.kind + ' · Sensibilidad ' + Math.round(it.sens * 100) + (it.rig === 'lure' ? ' · para señuelos' : ' · para cebo natural');
    if (cat === 'bait') {
      if (it.tech !== 'spin') return it.kind + ' · Boya o fondo' + (it.uses ? ' · pack ' + it.uses : '');
      var best = Object.keys(it.styles).sort(function (a, b) { return it.styles[b] - it.styles[a]; })[0];
      return it.kind + ' · ' + (it.sink < 0 ? 'Flota' : it.sink < 0.1 ? 'Suspending' : 'Se hunde') + ' · Mejor: ' + PF.Retrieve.NAMES[best];
    }
    return '';
  }
  function iconFor(cat, it) {
    var c = PF.BRANDS[it.brand].color;
    var svgs = {
      rod: '<svg viewBox="0 0 64 64"><path d="M8 56 L56 8" stroke="' + c + '" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="48" r="6" fill="#3a2a1a" stroke="' + c + '" stroke-width="2"/></svg>',
      reel: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="#3a2a1a" stroke="' + c + '" stroke-width="4"/><circle cx="32" cy="32" r="6" fill="' + c + '"/><path d="M32 32 L52 18" stroke="#e0d0a0" stroke-width="3"/></svg>',
      line: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="20" ry="12" fill="none" stroke="' + c + '" stroke-width="5"/><ellipse cx="32" cy="32" rx="12" ry="6" fill="none" stroke="' + c + '" stroke-width="3"/></svg>',
      leader: '<svg viewBox="0 0 64 64"><path d="M12 10 Q40 30 30 46 Q26 56 36 56" stroke="' + c + '" stroke-width="3" fill="none"/><path d="M36 56 q8 0 6 -8" stroke="#d8ccaa" stroke-width="3" fill="none"/></svg>',
      rig: it.rig === 'float' ? '<svg viewBox="0 0 64 64"><path d="M32 4 V18" stroke="#ffb040" stroke-width="3"/><circle cx="32" cy="26" r="9" fill="#e8572a"/><ellipse cx="32" cy="40" rx="9" ry="13" fill="#efe6cc"/><path d="M32 53 V62" stroke="' + c + '" stroke-width="2"/></svg>'
        : it.rig === 'bottom' ? '<svg viewBox="0 0 64 64"><path d="M32 4 V30" stroke="' + c + '" stroke-width="2"/><path d="M20 46 Q32 24 44 46 Q32 58 20 46Z" fill="#7a6a58" stroke="#2a1d10" stroke-width="2"/></svg>'
        : '<svg viewBox="0 0 64 64"><path d="M32 4 V22" stroke="' + c + '" stroke-width="2"/><path d="M26 22 h12 l-6 10 z" fill="#d8ccaa"/><path d="M32 32 V44 q0 10 8 6" stroke="#d8ccaa" stroke-width="3" fill="none"/></svg>',
      bait: '<svg viewBox="0 0 64 64"><ellipse cx="30" cy="32" rx="18" ry="8" fill="' + it.color + '" stroke="#2a1d10" stroke-width="2"/><circle cx="42" cy="30" r="2" fill="#1a140c"/><path d="M12 32 L4 24 L4 40 Z" fill="' + it.color + '"/></svg>'
    };
    return svgs[cat];
  }

  function renderTackle() {
    var d = PF.Save.data;
    var tabs = $('tackle-tabs');
    tabs.innerHTML = '';
    PF.GEAR_CATEGORIES.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'tab' + (c.key === tackleCat ? ' active' : '');
      b.textContent = c.label;
      b.onclick = function () { tackleCat = c.key; PF.Audio.play('tackle', 0.3, 1.4); renderTackle(); };
      tabs.appendChild(b);
    });
    var grid = $('tackle-grid');
    grid.innerHTML = '';
    var cat = PF.GEAR_CATEGORIES.filter(function (c) { return c.key === tackleCat; })[0];
    cat.list().forEach(function (it) {
      var owned = d.owned.indexOf(it.id) >= 0;
      var equipped = d.equip[tackleCat] === it.id;
      var locked = it.level > d.level;
      var card = document.createElement('div');
      card.className = 'item' + (equipped ? ' equipped' : '') + (locked ? ' locked' : '');
      var brand = PF.BRANDS[it.brand];
      var stock = it.uses != null && owned ? '<div class="stock">×' + (d.baitStock[it.id] || 0) + '</div>' : '';
      var btn;
      if (locked) btn = '<button class="btn small" disabled>Nivel ' + it.level + '</button>';
      else if (it.uses != null) btn = '<button class="btn small buy">◈ ' + it.price + ' (+' + it.uses + ')</button>' + (owned && !equipped ? '<button class="btn small equip">Equipar</button>' : '');
      else if (!owned) btn = '<button class="btn small buy">◈ ' + it.price + '</button>';
      else if (!equipped) btn = '<button class="btn small equip">Equipar</button>';
      else btn = '<button class="btn small" disabled>Equipado</button>';
      card.innerHTML = '<div class="item-brand" style="color:' + brand.color + '">' + brand.name + '</div>' +
        '<div class="item-icon">' + iconFor(tackleCat, it) + '</div>' + stock +
        '<div class="item-name">' + it.name + '</div>' +
        '<div class="item-stats">' + statLine(tackleCat, it) + '</div>' +
        '<div class="item-actions">' + btn + '</div>';
      var buy = card.querySelector('.buy'), eqb = card.querySelector('.equip');
      if (buy) buy.onclick = function () {
        if (d.amber < it.price) { toast('No tienes suficiente ámbar', 'danger'); return; }
        d.amber -= it.price;
        if (d.owned.indexOf(it.id) < 0) d.owned.push(it.id);
        if (it.uses != null) d.baitStock[it.id] = (d.baitStock[it.id] || 0) + it.uses;
        if (it.uses == null || !d.equip[tackleCat]) { d.equip[tackleCat] = it.id; if (tackleCat === 'rig' || tackleCat === 'bait') PF.fixCompat(d, tackleCat); }
        PF.Audio.play('tackle', 0.5);
        PF.Save.save(); refreshTop(); renderTackle();
        if (PF.Game && PF.Game.fishing) PF.Game.fishing.refreshGear();
      };
      if (eqb) eqb.onclick = function () {
        if (it.uses != null && !(d.baitStock[it.id] > 0)) { toast('Sin existencias', 'warn'); return; }
        d.equip[tackleCat] = it.id;
        if (tackleCat === 'rig' || tackleCat === 'bait') PF.fixCompat(d, tackleCat);
        PF.Audio.play('tackle', 0.4, 1.2);
        PF.Save.save(); refreshTop(); renderTackle();
        if (PF.Game && PF.Game.fishing) PF.Game.fishing.refreshGear();
      };
      grid.appendChild(card);
    });
    var eq = d.equip, rod = PF.findGear(eq.rod), line = PF.findGear(eq.line), reel = PF.findGear(eq.reel);
    var limit = Math.min(rod.power, line.test);
    $('tackle-summary').innerHTML = 'Límite del equipo: <b>' + limit + ' kg</b> (' + (rod.power < line.test ? 'la caña' : 'la línea') + ') · Freno máx. <b>' + reel.drag + ' kg</b>' +
      (reel.drag > limit ? ' <span class="warn-txt">⚠ el freno puede superar la línea</span>' : '');
  }

  /* ---------- Códex ---------- */
  function renderCodex() {
    var d = PF.Save.data, z = PF.getZone('wardie');
    var list = $('codex-list');
    list.innerHTML = '';
    var found = 0, total = 0;
    Object.keys(z.pool).forEach(function (id) {
      var sp = PF.SPECIES[id], e = d.codex[id];
      total++; if (e) found++;
      var el = document.createElement('div');
      el.className = 'codex-entry' + (e ? '' : ' unknown') + (sp.star ? ' star' : '');
      el.innerHTML = '<div class="cx-name">' + (e ? sp.name : '???') + (sp.star ? ' <span class="star">★</span>' : '') + '</div>' +
        '<div class="cx-sci">' + (e ? sp.sci : sp.group) + '</div>' +
        (e ? '<div class="cx-meta">Capturas: ' + e.count + ' · Récord: ' + U.fmtKg(e.best) + '</div><div class="cx-desc">' + sp.desc + '</div>' : '<div class="cx-desc">Aún no capturado.</div>');
      list.appendChild(el);
    });
    $('codex-progress').textContent = found + ' / ' + total + ' especies' + (d.codex.rhizodus_seen ? ' · Has presenciado un Rhizodus adulto' : '');
  }

  /* ---------- Selector de zonas ---------- */
  function renderZones(onPick) {
    var list = $('zone-list');
    list.innerHTML = '';
    PF.ZONES.forEach(function (z) {
      var el = document.createElement('div');
      el.className = 'zone-card' + (z.unlocked ? '' : ' locked');
      el.innerHTML = '<div class="zone-num">' + z.num + '</div><div class="zone-name">' + z.name + '</div><div class="zone-title">' + z.title + '</div>' +
        '<div class="zone-meta">' + z.location + '<br>' + z.age + '</div>' + (z.unlocked ? '<div class="zone-spots"></div>' : '<div class="zone-lock">🔒 Próximamente · Nivel ' + z.unlockLevel + '</div>');
      if (z.unlocked) {
        var sp = el.querySelector('.zone-spots');
        z.spots.forEach(function (s) {
          var b = document.createElement('button');
          b.className = 'btn small';
          b.innerHTML = s.name;
          b.title = s.desc;
          b.onclick = function () { onPick(z, s); };
          sp.appendChild(b);
        });
      }
      list.appendChild(el);
    });
  }

  /* ---------- HUD vivo (cada frame) ----------
     Inspirado en el HUD de Fishing Planet: 3 indicadores circulares de
     carga (caña / carrete / línea), distancia de línea, profundidad del
     señuelo, freno con %, marcha del carrete y estado de recogida. */
  var CIRC = 2 * Math.PI * 15;
  function gauge(id, v) {
    var el = $(id); if (!el) return;
    var p = Math.max(0, Math.min(1.2, v));
    var fg = el.querySelector('.g-fg');
    fg.style.strokeDasharray = CIRC;
    fg.style.strokeDashoffset = CIRC * (1 - Math.min(1, p));
    el.className = 'gauge' + (p > 0.85 ? ' danger' : p > 0.6 ? ' warn' : '');
    el.querySelector('.g-val').textContent = Math.round(p * 100) + '%';
  }
  var TECH_NAMES = { float: 'BOYA', bottom: 'FONDO', lure: 'SEÑUELO' };
  var lastBadge = '';
  function liveHud(f, state) {
    var T = f.tele, d = PF.Save.data;
    gauge('g-rod', T.rodLoad || 0);
    gauge('g-reel', T.reelLoad || 0);
    gauge('g-line', T.lineLoad || 0);
    $('reel-ico').classList.toggle('spin', !!T.reeling);
    $('g-reel').classList.toggle('reeling', !!T.reeling);
    $('g-reel').classList.toggle('slipping', !!T.slipping);
    $('g-dist-val').textContent = (T.lineOut || 0).toFixed(1) + ' m';
    var depthTxt = '';
    if (state === 'waiting' || state === 'bite') depthTxt = 'Prof. ' + T.depth.toFixed(1) + ' / ' + T.bottom.toFixed(1) + ' m';
    else if (state === 'fight') depthTxt = 'Pez a ' + Math.max(0, T.depth).toFixed(1) + ' m · ' + (T.tensionKg || 0).toFixed(1) + ' kg';
    $('g-depth').textContent = depthTxt;
    // marcha
    var pips = $('gear-pips').children;
    for (var i = 0; i < pips.length; i++) pips[i].className = i <= d.reelSpeed ? 'on' : '';
    // boya
    var isFloat = f.technique === 'float';
    show('depth-group', isFloat);
    if (isFloat) $('depth-val').textContent = d.floatDepth.toFixed(1) + ' m';
    // botón de tirón solo con señuelo
    $('btn-twitch').classList.toggle('hidden', !(f.technique === 'lure' && state === 'waiting') && state !== 'fight');
    // etiqueta del botón de acción
    var lbl = { idle: 'LANZAR', charging: 'SOLTAR', flying: '…', waiting: 'RECOGER', bite: '¡CLAVAR!', fight: 'RECOGER', landed: '' }[state] || '';
    $('action-label').textContent = lbl;
    // insignia de técnica + estilo
    var badge = '<b>' + TECH_NAMES[f.technique] + '</b>';
    if (f.technique === 'lure' && (state === 'waiting' || state === 'bite') && T.style) {
      var m = f.tele.styleMult || 0;
      var stars = m >= 1.5 ? '★★★' : m >= 1.0 ? '★★☆' : m >= 0.6 ? '★☆☆' : '☆☆☆';
      badge += ' · ' + PF.Retrieve.NAMES[T.style] + ' <span class="stars">' + stars + '</span>';
    } else if (state === 'waiting' && f.technique !== 'lure') {
      badge += T.reeling ? ' · recogiendo' : ' · esperando picada';
    }
    if (T.reeling) badge += ' <span class="reel-dot">⟳</span>';
    if (badge !== lastBadge) { $('tech-badge').innerHTML = badge; lastBadge = badge; }
    show('tech-badge', state !== 'landed');
  }

  function clock(hour) {
    var h = Math.floor(hour), m = Math.floor((hour - h) * 60);
    $('hud-clock').textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  return {
    $: $, show: show, screen: screen, refreshTop: refreshTop, toast: toast,
    castMeter: castMeter, bite: bite, habitat: habitat, lineInfo: lineInfo,
    fightHud: fightHud, fightUpdate: fightUpdate, dragInfo: dragInfo,
    showCatch: showCatch, liveHud: liveHud, renderTackle: renderTackle, renderCodex: renderCodex, renderZones: renderZones, clock: clock
  };
})();
