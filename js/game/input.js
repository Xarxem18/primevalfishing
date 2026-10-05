/* =====================================================================
   PRIMEVAL FISHING — ENTRADA UNIFICADA (PC + MÓVIL)
   ---------------------------------------------------------------------
   Toda la jugabilidad se reduce a una ACCIÓN contextual principal:
     inactivo  -> mantener = cargar lance, soltar = lanzar
     esperando -> mantener = recoger / animar señuelo
     picada    -> pulsar   = clavar
     combate   -> mantener = recoger línea
   Así el mismo esquema funciona con un dedo en móvil y con el ratón en PC.

   PC:   WASD/flechas mover · ratón mirar (pointer lock; o arrastrar con
         botón derecho) · Clic izq./Espacio = acción · Rueda o Q/E = freno
         (drag) · Shift = correr · Esc/P = pausa · M = mapa
         F / clic dcho. (ratón capturado) = tirón · 1-5 / R = marcha del
         carrete · Z/X = profundidad de la boya
   Móvil: joystick izq. · arrastrar mitad derecha = mirar · botón ACCIÓN ·
         botones +/- de freno · botón pausa.
   El resto del juego solo lee PF.Input.state y escucha eventos on().
   ===================================================================== */
window.PF = window.PF || {};

PF.Input = (function () {
  var state = {
    moveX: 0, moveY: 0, sprint: false,
    lookDX: 0, lookDY: 0,
    action: false,          // mantenido
    enabled: false
  };
  var listeners = {};
  var keys = {};

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, a) { (listeners[evt] || []).forEach(function (fn) { fn(a); }); }

  function setAction(v) {
    if (v && !state.action) emit('actionDown');
    if (!v && state.action) emit('actionUp');
    state.action = v;
  }

  function init(canvas) {
    /* ---------- Teclado ---------- */
    window.addEventListener('keydown', function (e) {
      if (!state.enabled) { if (e.code === 'Escape') emit('back'); return; }
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); setAction(true); }
      if (e.code === 'KeyQ') emit('drag', -0.05);
      if (e.code === 'KeyE') emit('drag', 0.05);
      if (e.code === 'Escape' || e.code === 'KeyP') emit('pause');
      if (e.code === 'KeyM') emit('map');
      if (e.code === 'KeyT') emit('skipTime');
      if (e.code === 'KeyF' && !e.repeat) emit('twitch');
      if (/^Digit[1-5]$/.test(e.code)) emit('reelGear', +e.code.slice(5) - 1);
      if (e.code === 'KeyR') emit('reelGear', '+');
      if (e.code === 'KeyZ') emit('floatDepth', -0.2);
      if (e.code === 'KeyX') emit('floatDepth', 0.2);
    });
    window.addEventListener('keyup', function (e) {
      keys[e.code] = false;
      if (e.code === 'Space') setAction(false);
    });

    /* ---------- Ratón ---------- */
    var rightDrag = false, lastX = 0, lastY = 0;
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('mousedown', function (e) {
      if (!state.enabled || PF.Util.isTouch() && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (e.button === 0) {
        if (!document.pointerLockElement && canvas.requestPointerLock && !PF.Input.noLock) {
          try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () { PF.Input.noLock = true; }); } catch (err) { PF.Input.noLock = true; }
        }
        setAction(true);
      }
      if (e.button === 2) {
        if (document.pointerLockElement === canvas) emit('twitch');   // con ratón capturado: clic dcho = tirón
        else { rightDrag = true; lastX = e.clientX; lastY = e.clientY; }
      }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) setAction(false);
      if (e.button === 2) rightDrag = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (!state.enabled) return;
      if (document.pointerLockElement === canvas) {
        state.lookDX += e.movementX; state.lookDY += e.movementY;
      } else if (rightDrag) {
        state.lookDX += e.clientX - lastX; state.lookDY += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
      }
    });
    canvas.addEventListener('wheel', function (e) {
      if (!state.enabled) return;
      e.preventDefault();
      emit('drag', e.deltaY > 0 ? -0.05 : 0.05);
    }, { passive: false });

    /* ---------- Táctil ---------- */
    var joy = document.getElementById('joystick'), knob = document.getElementById('joystick-knob');
    var joyId = null, joyCX = 0, joyCY = 0, lookId = null, lookLX = 0, lookLY = 0;
    var R = 52;
    canvas.addEventListener('touchstart', function (e) {
      if (!state.enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth * 0.4 && joyId === null) {
          joyId = t.identifier; joyCX = t.clientX; joyCY = t.clientY;
          joy.style.left = (joyCX - 65) + 'px'; joy.style.top = (joyCY - 65) + 'px';
          joy.classList.add('active');
        } else if (lookId === null) {
          lookId = t.identifier; lookLX = t.clientX; lookLY = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joyId) {
          var dx = t.clientX - joyCX, dy = t.clientY - joyCY, d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          state.moveX = dx / R; state.moveY = -dy / R;
          state.sprint = d > R * 0.95;
        } else if (t.identifier === lookId) {
          state.lookDX += (t.clientX - lookLX) * 1.6; state.lookDY += (t.clientY - lookLY) * 1.6;
          lookLX = t.clientX; lookLY = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joyId) {
          joyId = null; state.moveX = 0; state.moveY = 0; state.sprint = false;
          knob.style.transform = ''; joy.classList.remove('active');
        }
        if (t.identifier === lookId) lookId = null;
      }
    }
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);

    // Botones táctiles
    var act = document.getElementById('btn-action');
    act.addEventListener('touchstart', function (e) { e.preventDefault(); setAction(true); }, { passive: false });
    act.addEventListener('touchend', function (e) { e.preventDefault(); setAction(false); }, { passive: false });
    act.addEventListener('mousedown', function (e) { e.stopPropagation(); setAction(true); });
    bindTap('btn-drag-up', function () { emit('drag', 0.05); }, true);
    bindTap('btn-drag-down', function () { emit('drag', -0.05); }, true);
    bindTap('btn-pause', function () { emit('pause'); });
    bindTap('btn-twitch', function () { emit('twitch'); });
    bindTap('btn-gear-up', function () { emit('reelGear', Math.min(4, PF.Save.data.reelSpeed + 1)); });
    bindTap('btn-gear-down', function () { emit('reelGear', Math.max(0, PF.Save.data.reelSpeed - 1)); });
    bindTap('btn-depth-up', function () { emit('floatDepth', -0.2); }, true);
    bindTap('btn-depth-down', function () { emit('floatDepth', 0.2); }, true);
    bindTap('btn-map', function () { emit('map'); });
  }

  // Botón con repetición al mantener (para el freno)
  function bindTap(id, fn, repeat) {
    var el = document.getElementById(id), timer = null;
    if (!el) return;
    var start = function (e) {
      e.preventDefault(); e.stopPropagation(); fn();
      if (repeat) timer = setInterval(fn, 140);
    };
    var stop = function () { clearInterval(timer); timer = null; };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('touchend', stop);
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
  }

  /* Se llama una vez por frame: combina teclado con joystick */
  function poll() {
    if (!state.enabled) return;
    var kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    var ky = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    if (kx || ky) { state.moveX = kx; state.moveY = ky; state.sprint = !!(keys.ShiftLeft || keys.ShiftRight); state._kb = true; }
    else if (state._kb) { state.moveX = 0; state.moveY = 0; state.sprint = false; state._kb = false; }
  }

  function consumeLook() {
    var d = { x: state.lookDX, y: state.lookDY };
    state.lookDX = 0; state.lookDY = 0;
    return d;
  }

  function enable(v) {
    state.enabled = v;
    if (!v) {
      setAction(false); state.moveX = 0; state.moveY = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  return { init: init, on: on, poll: poll, consumeLook: consumeLook, enable: enable, state: state };
})();
