/* =====================================================================
   PRIMEVAL FISHING — ANALIZADOR DE RECOGIDA (técnicas de señuelo)
   ---------------------------------------------------------------------
   Inspirado en Fishing Planet: la forma de recoger cambia la eficacia de
   cada señuelo. En lugar de elegir el estilo en un menú, el estilo se
   DETECTA a partir de lo que hace el jugador en los últimos ~4 s:

     still     Parado          sin recoger (> 2.5 s)
     slow      Lenta uniforme  recogida continua, marcha 1-2
     uniform   Uniforme        recogida continua, marcha 3-4
     fast      Rápida          recogida continua, marcha 5
     stopgo    Pare y avance   alterna recoger/parar en ciclos de 0.4-2.5 s
     twitch    Twitching       ≥2 tirones de puntera en 4 s (jerkbaits)
     liftdrop  Jigging         tirones + caída libre (señuelo pesado al fondo)

   Cada señuelo tiene bait.styles[estilo] = multiplicador de picada.
   El HUD muestra el estilo detectado y su eficacia (★).
   ===================================================================== */
window.PF = window.PF || {};

PF.Retrieve = function () {
  var WINDOW = 4.0;
  var events = [];     // {t, type:'on'|'off'|'twitch'}
  var reeling = false, lastChange = 0, now = 0;
  var style = 'still', quality = 0;

  this.reset = function () { events = []; reeling = false; lastChange = now; style = 'still'; quality = 0; };

  this.update = function (dt, isReeling, gearIdx, nearBottom) {
    now += dt;
    if (isReeling !== reeling) {
      events.push({ t: now, type: isReeling ? 'on' : 'off', dur: now - lastChange });
      reeling = isReeling; lastChange = now;
    }
    while (events.length && now - events[0].t > WINDOW) events.shift();
    var twitches = 0, cycles = 0, goodCycles = 0;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'twitch') twitches++;
      else { cycles++; if (e.dur > 0.35 && e.dur < 2.6) goodCycles++; }
    }
    var held = now - lastChange;
    if (twitches >= 2) {
      style = nearBottom ? 'liftdrop' : 'twitch';
      quality = Math.min(1, twitches / 4);
    } else if (twitches >= 1 && nearBottom) {
      style = 'liftdrop'; quality = 0.6;
    } else if (cycles >= 3 && goodCycles >= 2) {
      style = 'stopgo'; quality = Math.min(1, goodCycles / 4);
    } else if (reeling) {
      style = gearIdx <= 1 ? 'slow' : gearIdx >= 4 ? 'fast' : 'uniform';
      quality = Math.min(1, held / 3);
    } else if (!reeling && held > 2.5) {
      style = 'still'; quality = 1;
    }
    return style;
  };

  this.twitch = function () { events.push({ t: now, type: 'twitch' }); };
  Object.defineProperty(this, 'style', { get: function () { return style; } });
  Object.defineProperty(this, 'quality', { get: function () { return quality; } });
  /* true durante ~1.2 s tras parar (momento clásico de ataque en pare y avance) */
  this.justStopped = function () { return !reeling && now - lastChange < 1.2 && now - lastChange > 0.1; };
};

PF.Retrieve.NAMES = {
  still: 'Parado', slow: 'Lenta uniforme', uniform: 'Uniforme', fast: 'Rápida',
  stopgo: 'Pare y avance', twitch: 'Twitching', liftdrop: 'Jigging (sube y cae)'
};
