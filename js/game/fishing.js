/* =====================================================================
   PRIMEVAL FISHING — SISTEMA DE PESCA
   ---------------------------------------------------------------------
   Máquina de estados:
     IDLE -> CHARGING -> FLYING -> WAITING -> (NIBBLE) -> BITE -> FIGHT
          -> LANDED (panel de captura) -> IDLE
     WAITING -> recoger hasta la orilla -> IDLE

   TÉCNICAS (v0.2) — definidas por el MONTAJE equipado (gear.rig.rig):
     float   boya a profundidad ajustable (Z/X). Picada = la boya se hunde.
     bottom  plomo al fondo, línea tensa. Picada = puntera + campanilla.
     lure    señuelo artificial con física propia (hundimiento, buceo,
             tirones). El estilo de recogida se detecta (retrieve.js) y
             cada señuelo tiene su multiplicador por estilo.
   Controles extra: 1-5 marcha del carrete · F/clic dcho. tirón (twitch).

   MODELO DE COMBATE (unidades en kg-fuerza):
     pull       fuerza del pez = 1.2 * kg^0.75 * strength * fase * energía
     demand     lo que la línea debe aguantar = pull "alejándose" + recogida
     dragKg     reel.drag * dragPct (el jugador lo ajusta en vivo)
     Si demand > dragKg el carrete cede línea (suena el freno) y la tensión
     se queda en dragKg (+ un pico si el drag es poco preciso).
     limit      min(line.test, rod.power). tensión > limit => rotura.
     Picos      sacudidas/saltos, amortiguados por flex de caña y
                elasticidad de la línea.
     Dientes    species.teeth vs leader.bite => riesgo de corte.
     Destense   tensión ~0 durante >2.2 s => el anzuelo puede soltarse.
     Bobina     si sale más línea que reel.cap => el pez se lleva todo.
   El equilibrio entre "demasiado" y "demasiado poco" es la fuente de
   adrenalina: hay que leer al pez, ajustar freno y recoger en los
   momentos de descanso.
   ===================================================================== */
window.PF = window.PF || {};

PF.Fishing = function (ctx) {
  var U = PF.Util, A = PF.Audio, Input = PF.Input;
  var scene = ctx.scene, camera = ctx.camera, zone = ctx.zone, terrain = ctx.terrain, ui = ctx.ui;
  var self = this;

  var S = { IDLE: 'idle', CHARGING: 'charging', FLYING: 'flying', WAITING: 'waiting', BITE: 'bite', FIGHT: 'fight', LANDED: 'landed' };
  this.S = S;
  this.state = S.IDLE;
  this.dragPct = 0.6;

  var gear = {};
  function refreshGear() {
    var e = PF.Save.data.equip;
    gear.rod = PF.findGear(e.rod); gear.reel = PF.findGear(e.reel); gear.line = PF.findGear(e.line);
    gear.leader = PF.findGear(e.leader); gear.bait = PF.findGear(e.bait);
    gear.rig = PF.findGear(e.rig || 'rig_float');
    self.technique = gear.rig.rig;
    if (lureMesh) {
      var vis = lureMesh.visible, p0 = lureMesh.position.clone();
      scene.remove(lureMesh);
      lureMesh = PF.Lures.build(gear.bait);
      lureMesh.visible = vis; lureMesh.position.copy(p0);
      scene.add(lureMesh);
    }
    if (bobber) bobber.visible = false;
  }
  this.refreshGear = refreshGear;

  /* ---------------- Caña (primera persona) ---------------- */
  var rodRoot = new THREE.Group();
  rodRoot.position.set(0.36, -0.5, -0.32);
  rodRoot.scale.setScalar(0.85);
  rodRoot.rotation.set(0.55, -0.12, 0);
  camera.add(rodRoot);
  var SEGS = 7, SEG_LEN = 0.34;
  var joints = [], parent = rodRoot;
  var rodMatA = new THREE.MeshLambertMaterial({ color: '#5a4026' });
  var rodMatB = new THREE.MeshLambertMaterial({ color: '#d8c9a0' });
  // Mango de madera con empuñadura de cuero (look "artesanal prehistórico")
  var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.36, 6), new THREE.MeshLambertMaterial({ color: '#3a2a1a' }));
  handle.rotation.x = Math.PI / 2; handle.position.z = 0.12; rodRoot.add(handle);
  var reelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), new THREE.MeshLambertMaterial({ color: '#8a6a3a' }));
  reelMesh.rotation.z = Math.PI / 2; reelMesh.position.set(0, -0.07, 0.05); rodRoot.add(reelMesh);
  var reelHandle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.07), new THREE.MeshLambertMaterial({ color: '#e0d0a0' }));
  reelHandle.position.set(0.035, 0, 0); reelMesh.add(reelHandle);
  for (var i = 0; i < SEGS; i++) {
    var j = new THREE.Group();
    j.position.z = i === 0 ? 0 : -SEG_LEN;
    var r0 = 0.02 * (1 - i / SEGS) + 0.004, r1 = 0.02 * (1 - (i + 1) / SEGS) + 0.003;
    var seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, SEG_LEN, 5), i % 2 ? rodMatB : rodMatA);
    seg.rotation.x = -Math.PI / 2; seg.position.z = -SEG_LEN / 2;
    j.add(seg);
    parent.add(j);
    joints.push(j);
    parent = j;
  }
  var tip = new THREE.Object3D(); tip.position.z = -SEG_LEN; parent.add(tip);
  var tipPos = new THREE.Vector3();
  var bend = 0, bendTarget = 0, rodYaw = 0;

  /* ---------------- Línea, señuelo, boya ---------------- */
  var LINE_PTS = 24;
  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  var line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4ecd4', transparent: true, opacity: 0.85 }));
  line.frustumCulled = false; line.visible = false; scene.add(line);
  var subGeo = new THREE.BufferGeometry();
  subGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var subLine = new THREE.Line(subGeo, line.material); subLine.frustumCulled = false; subLine.visible = false; scene.add(subLine);

  var lureMesh = new THREE.Group(); lureMesh.visible = false; scene.add(lureMesh); // se reconstruye en refreshGear
  var bobber = PF.Lures.bobber(); bobber.visible = false; scene.add(bobber);
  var retrieve = new PF.Retrieve();
  var dart = 0, falling = false, lureSpeed = 0, lureYaw = 0;
  this.tele = { reeling: false, gear: 3, style: 'still', styleMult: 0, lineOut: 0, depth: 0, bottom: 0, tension: 0, rodLoad: 0, reelLoad: 0 };

  /* ---------------- Partículas de salpicadura ---------------- */
  var PN = 90;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: '#f3ead2', size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }));
  particles.frustumCulled = false; scene.add(particles);
  var pIdx = 0;
  function splash(x, z, amount, power) {
    for (var k = 0; k < amount; k++) {
      var n = pIdx++ % PN;
      pPos[n * 3] = x; pPos[n * 3 + 1] = 0.05; pPos[n * 3 + 2] = z;
      var a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random()) * power;
      pVel[n * 3] = Math.cos(a) * sp * 0.5; pVel[n * 3 + 1] = (1.5 + Math.random() * 2) * power; pVel[n * 3 + 2] = Math.sin(a) * sp * 0.5;
      pLife[n] = 1;
    }
    terrain.addRipple(x, z, Math.min(1.5, 0.4 + power * 0.4));
  }
  this.splash = splash;
  function updateParticles(dt) {
    for (var n = 0; n < PN; n++) {
      if (pLife[n] <= 0) { pPos[n * 3 + 1] = -50; continue; }
      pLife[n] -= dt * 1.2;
      pVel[n * 3 + 1] -= 9.8 * dt;
      pPos[n * 3] += pVel[n * 3] * dt; pPos[n * 3 + 1] += pVel[n * 3 + 1] * dt; pPos[n * 3 + 2] += pVel[n * 3 + 2] * dt;
      if (pPos[n * 3 + 1] < 0) pLife[n] = 0;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  /* ---------------- Variables de lance/espera ---------------- */
  var power = 0, powerDir = 1;
  var lure = new THREE.Vector3(), lureFrom = new THREE.Vector3(), lureTo = new THREE.Vector3();
  var flyT = 0, flyDur = 1;
  var lureDepth = 0, reeling = false, lastReelStop = -10, waitTime = 0, biteTimer = 0;
  var nibble = null; // {species, kg, t, count}
  var approachFish = null;
  var biteWindow = 0;
  var fish = null; // estado del combate
  var heldFish = null; // malla mostrada en el panel de captura
  var apexEvent = null, apexAmbient = null, nextApexAmbient = 60 + Math.random() * 60;
  var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function camForward() {
    camera.getWorldDirection(tmp);
    tmp.y = 0; tmp.normalize();
    return tmp;
  }

  function waterDepth(x, z) { return -zone.heightAt(x, z); }

  /* ============ Acción principal ============ */
  Input.on('actionDown', function () {
    if (ctx.paused()) return;
    A.init();
    if (self.state === S.IDLE) {
      self.state = S.CHARGING; power = 0; powerDir = 1;
      ui.castMeter(true, 0);
    } else if (self.state === S.BITE) {
      hook();
    } else if (self.state === S.WAITING && nibble && !nibble.real) {
      // Clavar antes de tiempo: espanta al pez
      ui.toast('Demasiado pronto… el pez se ha asustado', 'warn');
      nibble = null; despawnApproach();
    }
  });
  Input.on('actionUp', function () {
    if (self.state === S.CHARGING) cast();
  });
  Input.on('twitch', function () {
    if (ctx.paused()) return;
    if (self.state === S.WAITING && self.technique === 'lure') {
      retrieve.twitch();
      dart = 0.35;
      bendKick = 0.35;
      var bt = gear.bait.lureType;
      // Tirón: avance brusco + subida (más en jigs pesados)
      tmp2.set(tipPos.x - lure.x, 0, tipPos.z - lure.z).normalize();
      lure.addScaledVector(tmp2, bt === 'jig' ? 0.35 : 0.6);
      lureDepth = Math.max(0, lureDepth - (bt === 'jig' ? 0.7 : 0.2));
      A.play('ui', 0.15, 2.2);
      if (lureDepth < 0.15) splash(lure.x, lure.z, 3, 0.3);
    } else if (self.state === S.FIGHT) {
      // Bombeo: levantar la caña da una recogida extra a cambio de un pico de tensión
      if (fish) { fish.lineOut -= 0.8; fish.spike = Math.max(fish.spike, fish.maxPull * 0.25); bendKick = 0.3; }
    }
  });
  Input.on('reelGear', function (g) {
    var d = PF.Save.data;
    d.reelSpeed = g === '+' ? (d.reelSpeed + 1) % PF.REEL_SPEEDS.length : U.clamp(g, 0, PF.REEL_SPEEDS.length - 1);
    ui.toast('Velocidad de recogida: ' + (d.reelSpeed + 1) + '/5', '');
  });
  Input.on('floatDepth', function (dlt) {
    var d = PF.Save.data;
    if (self.technique !== 'float') return;
    d.floatDepth = U.clamp(Math.round((d.floatDepth + dlt) * 10) / 10, 0.3, 6);
    ui.toast('Profundidad de la boya: ' + d.floatDepth.toFixed(1) + ' m', '');
  });
  Input.on('drag', function (d) {
    self.dragPct = U.clamp(self.dragPct + d, 0.05, 1);
    ui.dragInfo(self.dragPct, gear.reel.drag * self.dragPct);
  });

  function cast() {
    ui.castMeter(false);
    PF.Save.data.stats.casts++;
    var fwd = camForward().clone();
    var dist = (10 + 40 * Math.pow(power, 0.9)) * gear.rod.cast;
    // Dispersión: más lejos = menos preciso
    var spread = (Math.random() - 0.5) * 0.08 * power;
    fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    tip.getWorldPosition(tipPos);
    lureFrom.copy(tipPos);
    lureTo.set(ctx.player.pos.x + fwd.x * dist, 0, ctx.player.pos.z + fwd.z * dist);
    flyT = 0; flyDur = 0.55 + power * 0.75;
    self.state = S.FLYING;
    lureMesh.visible = true; line.visible = true;
    bendTarget = -0.5;
    A.play('cast', 0.7);
  }

  function landLure() {
    var d = waterDepth(lureTo.x, lureTo.z);
    lure.copy(lureTo);
    if (d < 0.15) {
      ui.toast('Ha caído en tierra. Recoge y vuelve a lanzar.', 'warn');
      resetLine();
      return;
    }
    splash(lure.x, lure.z, 8, 0.6);
    A.play('plop', 0.8);
    self.state = S.WAITING;
    waitTime = 0; biteTimer = 0; lureDepth = 0; nibble = null; reeling = false;
    retrieve.reset(); dart = 0;
    if (self.technique === 'float') { bobber.visible = true; bobber.position.set(lure.x, 0, lure.z); }
    var hab = zone.habitatAt(lure.x, lure.z, d);
    ui.habitat(zone.habitats[hab].name + ' · ' + d.toFixed(1) + ' m');
  }

  function resetLine() {
    self.state = S.IDLE;
    lureMesh.visible = false; bobber.visible = false; line.visible = false; subLine.visible = false;
    nibble = null; despawnApproach(); fish = null; biteWindow = 0;
    A.setReel(0); A.setDrag(0); A.setTension(0); A.setIntensity(0);
    ui.fightHud(false); ui.bite(false); ui.habitat('');
    bendTarget = 0;
    self.lookTarget = null;
  }
  this.resetLine = resetLine;

  /* ============ Selección de especie (pool por microhábitat) ============ */
  function activityKey(h) {
    if (h >= 5 && h < 8.5) return 'dawn';
    if (h >= 8.5 && h < 17.5) return 'day';
    if (h >= 17.5 && h < 21) return 'dusk';
    return 'night';
  }

  function speciesWeights(x, z, hour) {
    var d = waterDepth(x, z);
    var hab = zone.habitatAt(x, z, d);
    var act = activityKey(hour);
    var bait = gear.bait, list = [], total = 0;
    var visPenalty = 1 - (gear.line.vis + gear.leader.vis) * (act === 'night' ? 0.08 : 0.28);
    for (var id in zone.pool) {
      var sp = PF.SPECIES[id];
      var w = sp.rarity * (zone.pool[id][hab] || 0) * sp.activity[act];
      var diet = 0;
      for (var k in bait.attract) diet += bait.attract[k] * (sp.diet[k] || 0);
      w *= Math.min(1.2, diet);
      var avg = (sp.weight[0] + sp.weight[1]) / 2;
      var sizeScore = U.clamp((Math.log10(avg) + 1.5) / 3, 0, 1);
      if (bait.size > sizeScore + 0.3) w *= Math.exp(-(bait.size - sizeScore - 0.3) * 6);
      if (bait.size < sizeScore - 0.45) w *= 0.4;
      if (sp.star) w *= visPenalty;
      // Técnica: el fondo favorece bentónicos; la boya, peces de media agua
      var benthic = sp.tags.indexOf('BENTHIC') >= 0 || sp.tags.indexOf('DUROPHAGOUS') >= 0;
      if (self.technique === 'bottom') w *= benthic ? 1.9 : 0.55;
      if (self.technique === 'float') w *= benthic ? 0.6 : 1.2;
      if (self.technique === 'lure') {
        // Profundidad del señuelo: depredadores de fondo prefieren señuelos bajos
        var rel = d > 0.3 ? lureDepth / d : 0;
        w *= benthic ? 0.4 + rel : 1.1 - rel * 0.3;
      }
      if (w > 0.0001) { list.push({ w: w, v: sp }); total += w; }
    }
    return { list: list, total: total, hab: hab, depth: d };
  }

  function rollBite(dt, hour) {
    var info = speciesWeights(lure.x, lure.z, hour);
    var techMult = 1;
    if (self.technique === 'lure') {
      var styles = gear.bait.styles || {};
      var m = styles[retrieve.style] != null ? styles[retrieve.style] : 0.5;
      techMult = m * (0.5 + retrieve.quality * 0.7);
      if (retrieve.justStopped()) techMult *= 1.6;       // ataque al parar
      if (dart > 0) techMult *= 1.4;                     // reacción al tirón
      if (lureSpeed > 2.6) techMult *= 0.6;              // demasiado rápido
      self.tele.styleMult = m;
    } else if (self.technique === 'bottom') {
      techMult = reeling ? 0.2 : 1.1;
    } else {
      techMult = reeling ? 0.3 : 1.0;
    }
    var perSec = Math.min(0.3, 0.035 + 0.0009 * info.total) * techMult;
    // Calentamiento: los primeros segundos tras el lance hay menos actividad
    perSec *= U.smooth(0, 3, waitTime);
    if (Math.random() < perSec * dt) {
      var sp = U.pickWeighted(info.list);
      if (!sp) return;
      var kg = PF.rollWeight(sp, gear.bait.size * 0.9);
      nibble = { species: sp, kg: kg, t: 0, count: 0, next: 0.6 + Math.random(), real: false, hab: info.hab };
      spawnApproach(sp, kg);
    }
  }

  /* El pez se acerca visiblemente al cebo antes de morder (anticipación) */
  function spawnApproach(sp, kg) {
    despawnApproach();
    var m = PF.FishMesh.create(sp);
    var L = PF.FishMesh.lengthForKg(sp, kg);
    m.scale.setScalar(L);
    var a = Math.random() * Math.PI * 2;
    m.position.set(lure.x + Math.cos(a) * 4, -Math.min(1.4, 0.4 + L), lure.z + Math.sin(a) * 4);
    scene.add(m);
    approachFish = { mesh: m, swim: 0 };
  }
  function despawnApproach() {
    if (approachFish) { scene.remove(approachFish.mesh); approachFish.mesh.material.dispose(); approachFish = null; }
  }
  function updateApproach(dt) {
    if (!approachFish) return;
    var m = approachFish.mesh;
    tmp2.set(lure.x - m.position.x, 0, lure.z - m.position.z);
    var dist = tmp2.length();
    if (dist > 0.3) {
      tmp2.normalize();
      m.position.addScaledVector(tmp2, Math.min(dist, dt * 1.6));
      m.rotation.y = Math.atan2(tmp2.x, tmp2.z);
    }
    approachFish.swim += dt * 9;
    m.material.userData.uni.uSwim.value = approachFish.swim;
  }

  function updateNibble(dt) {
    if (!nibble) return;
    nibble.t += dt;
    var sp = nibble.species;
    var predator = sp.diet.fish > 0.6;
    if (!nibble.real) {
      if (nibble.t > nibble.next) {
        nibble.count++;
        nibble.next = nibble.t + 0.5 + Math.random() * 0.9;
        // Toques de la boya / puntera
        bobberDip = 0.25; bendKick = 0.15;
        if (self.technique === 'float') A.play('plop', 0.18, 1.7);
        if (self.technique === 'bottom') A.play('bell', 0.35, 1.1);
        terrain.addRipple(lure.x, lure.z, 0.3);
        var needed = predator ? 1 : 2 + Math.floor(Math.random() * 2);
        if (nibble.count >= needed) {
          // Picada real
          nibble.real = true;
          if (self.technique === 'lure' && reeling && Math.random() < 0.7) { hook(); return; }
          self.state = S.BITE;
          biteWindow = 0.55 + (gear.rod.sens + gear.line.sensBonus) * 0.7;
          ui.bite(true);
          if (navigator.vibrate) navigator.vibrate(120);
          splash(lure.x, lure.z, predator ? 12 : 4, predator ? 1 : 0.4);
          A.play(self.technique === 'bottom' ? 'bell' : (predator ? 'splashSmall' : 'plop'), 0.8);
        }
      }
    }
  }
  var bobberDip = 0, bendKick = 0;

  /* ============ Clavado y combate ============ */
  function hook() {
    var sp = nibble.species, kg = nibble.kg;
    ui.bite(false);
    // Probabilidad de clavar: sensibilidad + tipo de anzuelo implícito
    var hookChance = 0.82 + gear.rod.sens * 0.15;
    if (Math.random() > hookChance) {
      ui.toast('¡Fallaste el clavado!', 'warn');
      nibble = null; despawnApproach(); self.state = S.WAITING; return;
    }
    var m = approachFish ? approachFish.mesh : PF.FishMesh.create(sp);
    approachFish = null;
    var L = PF.FishMesh.lengthForKg(sp, kg);
    m.scale.setScalar(L);
    if (!m.parent) scene.add(m);
    m.position.set(lure.x, -0.6, lure.z);
    tip.getWorldPosition(tipPos);
    var dist = Math.hypot(lure.x - tipPos.x, lure.z - tipPos.z);
    fish = {
      sp: sp, kg: kg, mesh: m, len: L, cat: PF.categoryFor(sp, kg),
      pos: new THREE.Vector3(lure.x, -Math.min(2.5, 0.6 + L * 0.5), lure.z),
      heading: Math.random() * Math.PI * 2,
      maxPull: 1.2 * Math.pow(kg, 0.75) * sp.strength,
      stamina: 1, stamMax: Math.pow(kg, 0.55) * sp.stamina * 7 + 4,
      phase: 'run', phaseT: 0, phaseDur: 2 + Math.random() * 2,
      lineOut: dist + 1, tension: 0, slack: 0, swim: 0, jump: 0, jumpV: 0,
      spike: 0, lastRun: false, hab: nibble.hab, time: 0
    };
    nibble = null;
    self.state = S.FIGHT;
    self.lookTarget = null;
    ui.fightHud(true, sp);
    ui.habitat('');
    ui.toast('¡Enganchado!', 'good');
    A.setIntensity(0.7 + Math.min(0.3, kg / 40));
    splash(fish.pos.x, fish.pos.z, 18, 1.2);
    A.play('splashBig', 0.6 + Math.min(0.4, kg / 20));
    retrieve.reset();
    bobber.visible = false; lureMesh.visible = false;
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    // Encuentro apex: Rhizodus adulto intenta robar la captura
    apexEvent = null;
    var enc = zone.encounters;
    if (enc && sp.id !== enc.apexSpecies && kg < 5 && (fish.hab === 'channel' || fish.hab === 'weeds') && Math.random() < enc.apexAttackChance * 3) {
      apexEvent = { delay: 3 + Math.random() * 5, mesh: null };
    }
  }

  var PHASES = {
    run:    { pull: 1.0, speed: 1.0, effort: 1.0 },
    rest:   { pull: 0.25, speed: 0.25, effort: -0.25 },
    thrash: { pull: 0.7, speed: 0.3, effort: 0.9 },
    charge: { pull: 0.0, speed: 1.2, effort: 0.6 },
    tired:  { pull: 0.15, speed: 0.2, effort: 0.0 }
  };

  function nextPhase() {
    var f = fish, sp = f.sp, r = Math.random();
    if (f.stamina <= 0.02) { f.phase = 'tired'; f.phaseDur = 99; return; }
    var e = f.stamina;
    if (r < 0.42 * e + 0.1) f.phase = 'run';
    else if (r < 0.42 * e + 0.1 + sp.jumpy * 0.35) f.phase = 'thrash';
    else if (r < 0.42 * e + 0.25 + sp.jumpy * 0.35) f.phase = 'charge';
    else f.phase = 'rest';
    f.phaseT = 0;
    f.phaseDur = f.phase === 'thrash' ? 1.2 + Math.random() : f.phase === 'rest' ? 1.2 + Math.random() * 2 : 1.8 + Math.random() * 2.8;
    tip.getWorldPosition(tipPos);
    var away = Math.atan2(f.pos.x - tipPos.x, f.pos.z - tipPos.z);
    if (f.phase === 'run') f.heading = away + (Math.random() - 0.5) * 2.2;
    else if (f.phase === 'charge') f.heading = away + Math.PI + (Math.random() - 0.5) * 0.8;
    else f.heading = away + (Math.random() - 0.5) * 3;
    if (f.phase === 'thrash' && sp.jumpy > 0.2 && f.pos.y > -2.2 && Math.random() < sp.jumpy + 0.2) {
      f.jumpV = 3.5 + Math.random() * 2; // salto fuera del agua
    }
  }

  function updateFight(dt) {
    var f = fish, sp = f.sp, ph = PHASES[f.phase];
    f.time += dt;
    f.phaseT += dt;
    if (f.phaseT > f.phaseDur) nextPhase();
    tip.getWorldPosition(tipPos);
    var dx = f.pos.x - tipPos.x, dz = f.pos.z - tipPos.z;
    var dist = Math.hypot(dx, dz);
    var awayX = dx / (dist || 1), awayZ = dz / (dist || 1);
    var hx = Math.sin(f.heading), hz = Math.cos(f.heading);
    var energy = 0.3 + 0.7 * f.stamina;
    var pull = f.maxPull * ph.pull * energy;
    var alongAway = hx * awayX + hz * awayZ;
    var demandFish = pull * Math.max(0, alongAway);
    var speed = (1.2 + Math.log(1 + f.kg) * 0.8) * ph.speed * energy;

    // Evitar orilla/zonas secas: el pez gira si se queda sin agua
    var ahead = waterDepth(f.pos.x + hx * 2, f.pos.z + hz * 2);
    if (ahead < 0.5 && dist > 6) { f.heading += Math.PI * 0.6; }

    // Movimiento deseado del pez
    f.pos.x += hx * speed * dt; f.pos.z += hz * speed * dt;

    // Recogida
    reeling = Input.state.action;
    var dragKg = gear.reel.drag * self.dragPct;
    var reelForce = reeling ? 0.25 + Math.sqrt(f.kg) * 0.35 * energy : 0;
    var demand;
    var taut = f.lineOut <= dist + 0.05;
    var gearF = PF.REEL_SPEEDS[PF.Save.data.reelSpeed];
    // Marchas altas = recoges más rápido pero exige más fuerza (más tensión)
    reelForce *= 0.6 + gearF * 0.5;
    demand = demandFish + reelForce;
    var slipping = false;
    var tension;
    if (!taut && demandFish <= 0.001) {
      tension = reeling ? 0.1 : 0;
    } else if (demand > dragKg) {
      slipping = true;
      // Drag poco preciso: tirón brusco al empezar a ceder
      var stick = (1 - gear.reel.dragPrec) * dragKg * (0.25 + Math.random() * 0.35);
      tension = dragKg + stick;
    } else {
      tension = demand;
    }
    // Picos por sacudidas (amortiguados por flex/elasticidad)
    if (f.phase === 'thrash' || (f.phase === 'run' && Math.random() < 0.05)) {
      var damp = 1 - gear.rod.flex * 0.45 - gear.line.stretch * 0.35;
      f.spike = Math.max(f.spike, f.maxPull * (0.25 + Math.random() * 0.45) * damp * energy * (Math.random() < 0.15 ? 1 : 0));
    }
    f.spike *= Math.pow(0.02, dt);
    tension += f.spike;

    // Longitud de línea
    var reelSpeed = gear.reel.speed * gearF * (f.phase === 'tired' ? 1.15 : 1);
    if (slipping) {
      var payout = speed * (1 - dragKg / Math.max(demand, 0.01)) + 0.2;
      f.lineOut = Math.max(f.lineOut, dist) + payout * dt * 0.0; // la línea sigue al pez
      f.lineOut = Math.max(f.lineOut, dist);
      A.setDrag(Math.min(1, 0.3 + payout * 0.25));
    } else {
      A.setDrag(0);
      if (reeling) f.lineOut -= reelSpeed * dt;
    }
    A.setReel(reeling && !slipping ? 1 : 0);
    // Restricción de la línea: si no cede, el pez no puede alejarse más
    if (!slipping && dist > f.lineOut) {
      var k = f.lineOut / dist;
      f.pos.x = tipPos.x + dx * k; f.pos.z = tipPos.z + dz * k;
    } else if (slipping) {
      // al ceder, el pez avanza más lento (el freno trabaja)
      var slow = 1 - (dragKg / Math.max(demand, 0.01)) * 0.6;
      f.pos.x -= hx * speed * dt * (1 - slow); f.pos.z -= hz * speed * dt * (1 - slow);
      dist = Math.hypot(f.pos.x - tipPos.x, f.pos.z - tipPos.z);
      f.lineOut = Math.max(f.lineOut, dist);
    }
    f.lineOut = Math.max(f.lineOut, 0.5);

    // Energía del pez
    var effort = ph.effort * (0.6 + 0.6 * Math.min(1.5, tension / Math.max(0.2, f.maxPull)));
    f.stamina = U.clamp(f.stamina - effort * dt / f.stamMax, 0, 1);
    if (f.stamina <= 0.02 && f.phase !== 'tired') { f.phase = 'tired'; f.phaseDur = 99; ui.toast('El pez está agotado. ¡Recoge!', 'good'); }

    // Profundidad visual: sube a la superficie al cansarse / cerca de la orilla
    var depthHere = waterDepth(f.pos.x, f.pos.z);
    var targetY = -Math.min(depthHere - 0.15, (f.phase === 'tired' ? 0.25 : 0.5 + f.stamina * 1.4) + f.len * 0.3);
    if (f.jumpV > 0 || f.pos.y > 0) {
      f.pos.y += f.jumpV * dt; f.jumpV -= 9.8 * dt;
      if (f.pos.y < 0 && f.jumpV < 0) {
        f.jumpV = 0; splash(f.pos.x, f.pos.z, 20, 1.4); A.play('splashBig', 0.7);
        f.spike = Math.max(f.spike, f.maxPull * 0.6);
      }
    } else {
      f.pos.y = U.lerp(f.pos.y, targetY, dt * 1.5);
    }
    if (f.phase === 'thrash' && Math.random() < dt * 6 && f.pos.y > -1) splash(f.pos.x, f.pos.z, 3, 0.6);

    // Malla del pez
    f.swim += dt * (6 + speed * 6);
    f.mesh.position.copy(f.pos);
    var mv = Math.atan2(hx, hz);
    f.mesh.rotation.y = U.lerp(f.mesh.rotation.y, mv, 0.1);
    // Cabeceo en superficie cuando está cerca o en sacudidas (look Fishing Planet)
    var nearSurf = f.pos.y > -0.6;
    f.mesh.rotation.z = f.pos.y > 0 ? Math.sin(f.swim) * 0.5 : (nearSurf && f.phase === 'thrash' ? Math.sin(f.swim * 1.7) * 0.6 : 0);
    f.mesh.rotation.x = nearSurf && (f.phase === 'thrash' || f.phase === 'tired') ? -0.25 + Math.sin(f.swim * 0.9) * 0.2 : 0;
    if (nearSurf && f.phase === 'tired' && Math.random() < dt * 2) { splash(f.pos.x, f.pos.z, 2, 0.35); }
    f.mesh.material.userData.uni.uSwim.value = f.swim;
    f.mesh.material.userData.uni.uAmp.value = f.phase === 'thrash' ? 0.3 : 0.14;

    /* ---- Condiciones de pérdida ---- */
    var limit = Math.min(gear.line.test, gear.rod.power);
    f.tension = tension;
    var tNorm = tension / limit;
    A.setTension(tNorm);
    bendTarget = -Math.min(1.4, 0.15 + tNorm * 1.1);
    if (tension > limit) {
      var rodWeak = gear.rod.power < gear.line.test;
      lose(rodWeak ? '¡La caña ha cedido! El pez se ha escapado.' : '¡Línea rota!', 'snap');
      return;
    }
    if (sp.teeth > gear.leader.bite && (f.phase === 'thrash' || f.phase === 'run')) {
      var risk = (sp.teeth - gear.leader.bite) * 0.05 * dt * (f.phase === 'thrash' ? 3 : 1);
      if (Math.random() < risk) { lose('Los dientes han cortado la línea. Usa un leader más resistente.', 'snap'); return; }
    }
    if (tension < 0.06) f.slack += dt; else f.slack = Math.max(0, f.slack - dt * 2);
    if (f.slack > 2.2 && Math.random() < dt * 0.9) { lose('La línea se destensó y el pez escupió el anzuelo.', 'lost'); return; }
    if (f.lineOut > gear.reel.cap) { lose('¡Te ha vaciado la bobina!', 'snap'); return; }

    // Encuentro apex
    if (apexEvent) updateApexAttack(dt);
    if (!fish) return;

    // Llegada a la orilla
    if (f.lineOut < 2.6) {
      if (f.stamina < 0.4 || f.kg < 1.2) { landFish(); return; }
      if (!f.lastRun) { f.lastRun = true; f.phase = 'run'; f.phaseT = 0; f.phaseDur = 2; f.heading = Math.atan2(dx, dz); ui.toast('¡Última carrera!', 'warn'); f.spike = f.maxPull * 0.5; }
      else f.lineOut = 2.6;
    }

    var T = self.tele;
    T.reeling = reeling && !slipping; T.slipping = slipping; T.lineOut = f.lineOut; T.depth = -f.pos.y;
    T.tension = tNorm; T.rodLoad = tension / gear.rod.power; T.reelLoad = tension / gear.reel.drag; T.lineLoad = tension / gear.line.test;
    T.tensionKg = tension;
    ui.fightUpdate({
      tension: tNorm, line: f.lineOut, cap: gear.reel.cap, stamina: f.stamina,
      drag: self.dragPct, dragKg: dragKg, slipping: slipping, phase: f.phase
    });
    A.setIntensity(0.5 + tNorm * 0.5);
    if (tNorm > 0.85 && navigator.vibrate && Math.random() < dt * 4) navigator.vibrate(30);
    ctx.shake(tNorm > 0.7 ? (tNorm - 0.7) * 0.05 : 0);
    // Asistencia de cámara: si el pez sale del encuadre, la vista lo sigue con suavidad
    self.lookTarget = f.pos;
  }

  /* Rhizodus adulto aparece y se lanza contra la captura */
  function updateApexAttack(dt) {
    var e = apexEvent, f = fish;
    e.delay -= dt;
    if (e.delay > 0) return;
    if (!e.mesh) {
      var rz = PF.SPECIES[zone.encounters.apexSpecies];
      e.mesh = PF.FishMesh.create(rz, { silhouette: true });
      e.mesh.scale.setScalar(4.5);
      var a = Math.atan2(f.pos.x - tipPos.x, f.pos.z - tipPos.z) + (Math.random() - 0.5);
      e.mesh.position.set(f.pos.x + Math.sin(a) * 18, -1.6, f.pos.z + Math.cos(a) * 18);
      scene.add(e.mesh); e.swim = 0;
      ui.toast('¡Una sombra enorme se acerca a tu pez!', 'danger');
      A.setIntensity(1);
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    }
    var m = e.mesh;
    tmp2.set(f.pos.x - m.position.x, 0, f.pos.z - m.position.z);
    var d = tmp2.length();
    tmp2.normalize();
    m.position.addScaledVector(tmp2, dt * 5.5);
    m.rotation.y = Math.atan2(tmp2.x, tmp2.z);
    e.swim += dt * 7; m.material.userData.uni.uSwim.value = e.swim;
    if (Math.random() < dt * 3) terrain.addRipple(m.position.x, m.position.z, 0.6);
    if (d < 1.5) {
      splash(f.pos.x, f.pos.z, 45, 2.2);
      A.play('splashBig', 1, 0.7);
      ui.toast('¡RHIZODUS se ha tragado tu captura!', 'danger');
      PF.Save.data.codex.rhizodus_seen = true;
      var mesh = m;
      lose(null, 'apex');
      // la sombra se aleja
      var t0 = 0;
      var leave = function () {
        t0 += 0.016; mesh.position.addScaledVector(tmp2, 0.12); mesh.position.y -= 0.01;
        mesh.material.opacity = Math.max(0, 0.55 - t0 * 0.3);
        if (t0 < 2) requestAnimationFrame(leave); else { scene.remove(mesh); }
      };
      leave();
    }
  }

  function lose(msg, kind) {
    var st = PF.Save.data.stats;
    if (kind === 'snap') { st.snapped++; A.play('snap', 1); if (navigator.vibrate) navigator.vibrate(250); }
    else st.lost++;
    if (msg) ui.toast(msg, 'danger');
    if (fish) { scene.remove(fish.mesh); fish.mesh.material.dispose(); }
    if (apexEvent && apexEvent.mesh && kind !== 'apex') scene.remove(apexEvent.mesh);
    apexEvent = null;
    fish = null;
    ctx.shake(0);
    PF.Save.save();
    resetLine();
  }

  function landFish() {
    var f = fish;
    A.setDrag(0); A.setReel(0); A.setTension(0);
    splash(f.pos.x, f.pos.z, 25, 1.2);
    A.play('splashSmall', 0.9);
    if (apexEvent && apexEvent.mesh) scene.remove(apexEvent.mesh);
    apexEvent = null;
    self.state = S.LANDED;
    line.visible = false;
    ui.fightHud(false);
    ctx.shake(0);
    // El pez se presenta delante de la cámara
    scene.remove(f.mesh);
    heldFish = f.mesh;
    var showLen = Math.min(1.1, Math.max(0.35, f.len));
    heldFish.scale.setScalar(showLen);
    heldFish.position.set(0, 0.32, -1.2 - showLen * 0.5);
    heldFish.rotation.set(0, Math.PI / 2, 0);
    camera.add(heldFish);
    rodRoot.visible = false;
    var data = { species: f.sp, kg: f.kg, cat: f.cat, value: Math.round(f.kg * f.sp.value * f.cat.mult + 5), xp: Math.round(10 + Math.sqrt(f.kg) * 14 * f.cat.mult * (f.sp.star ? 2 : 1)) };
    fish = null;
    PF.Save.data.stats.catches++;
    registerCodex(data);
    A.setIntensity(0.2);
    ui.showCatch(data, function (keep) {
      var sd = PF.Save.data;
      if (keep) sd.amber += data.value;
      var lv = PF.Save.addXp(keep ? data.xp : Math.round(data.xp * 1.3));
      if (lv) ui.toast('¡Nivel ' + sd.level + '! Nuevo equipo disponible en la tienda.', 'good');
      PF.Save.save();
      camera.remove(heldFish); heldFish.material.dispose(); heldFish = null;
      rodRoot.visible = true;
      if (!keep) { ui.toast('Liberado. +30% XP por conservación', 'good'); }
      ui.refreshTop();
      // Consumo de cebo natural
      useBait();
      resetLine();
    });
  }

  function useBait() {
    var b = gear.bait, sd = PF.Save.data;
    if (b.uses == null) return;
    ui.refreshTop();
    sd.baitStock[b.id] = (sd.baitStock[b.id] || 0) - 1;
    if (sd.baitStock[b.id] <= 0) {
      sd.baitStock[b.id] = 0;
      ui.toast('Te has quedado sin ' + b.name + '. Equipa otro cebo.', 'warn');
      sd.equip.bait = 'lure_spinner';
      PF.fixCompat(sd, 'bait');
      refreshGear(); ui.refreshTop();
    }
  }

  function registerCodex(d) {
    var c = PF.Save.data.codex;
    var e = c[d.species.id] || { count: 0, best: 0, firstAt: Date.now() };
    var isNew = e.count === 0;
    e.count++;
    var record = d.kg > e.best;
    e.best = Math.max(e.best, d.kg);
    c[d.species.id] = e;
    d.isNew = isNew; d.isRecord = record && !isNew;
    PF.Save.data.records.unshift({ id: d.species.id, kg: d.kg, cat: d.cat.id, t: Date.now() });
    PF.Save.data.records = PF.Save.data.records.slice(0, 30);
  }

  /* Rhizodus adulto patrullando (encuentro ambiental, no pescable) */
  function updateApexAmbient(dt) {
    nextApexAmbient -= dt;
    if (!apexAmbient && nextApexAmbient <= 0 && self.state !== S.FIGHT) {
      var rz = PF.SPECIES[zone.encounters.apexSpecies];
      var m = PF.FishMesh.create(rz, { silhouette: true });
      m.scale.setScalar(4 + Math.random() * 1.5);
      var p = ctx.player.pos;
      var dir = Math.random() < 0.5 ? 1 : -1;
      var z = zone.channelZ(p.x) + 20 + Math.random() * 10;
      m.position.set(p.x - dir * 60, -1.8, z);
      scene.add(m);
      apexAmbient = { mesh: m, dir: dir, t: 0, swim: 0 };
      var r = zone.encounters.apexAmbientEvery;
      nextApexAmbient = r[0] + Math.random() * (r[1] - r[0]);
    }
    if (apexAmbient) {
      var a = apexAmbient;
      a.t += dt; a.swim += dt * 4;
      a.mesh.position.x += a.dir * dt * 3.2;
      a.mesh.position.z += Math.sin(a.t * 0.4) * dt * 0.8;
      a.mesh.rotation.y = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      a.mesh.material.userData.uni.uSwim.value = a.swim;
      a.mesh.material.opacity = 0.45 * U.smooth(0, 4, a.t) * U.smooth(38, 32, a.t);
      if (Math.random() < dt * 1.2) terrain.addRipple(a.mesh.position.x, a.mesh.position.z, 0.35);
      if (a.t > 38) { scene.remove(a.mesh); a.mesh.material.dispose(); apexAmbient = null; }
    }
  }

  /* Bancos de peces que rompen la superficie: pistas de dónde lanzar */
  var boilTimer = 2;
  function updateBoils(dt, hour) {
    boilTimer -= dt;
    if (boilTimer > 0) return;
    var act = activityKey(hour);
    boilTimer = (act === 'dawn' || act === 'dusk' ? 1.5 : 4) + Math.random() * 3;
    var p = ctx.player.pos;
    var w = zone.weeds[Math.floor(Math.random() * zone.weeds.length)];
    var x = Math.random() < 0.6 ? w.x + (Math.random() - 0.5) * w.r : p.x + (Math.random() - 0.5) * 80;
    var z = Math.random() < 0.6 ? w.z + (Math.random() - 0.5) * w.r : p.z - 10 - Math.random() * 40;
    if (waterDepth(x, z) < 0.6) return;
    splash(x, z, 5, 0.5);
  }

  /* ============ Bucle ============ */
  this.update = function (dt, time, hour) {
    updateParticles(dt);
    updateApexAmbient(dt);
    updateBoils(dt, hour);

    // Curvatura de la caña
    bend = U.lerp(bend, bendTarget + (bendKick > 0 ? -bendKick : 0), Math.min(1, dt * 10));
    bendKick = Math.max(0, bendKick - dt * 0.8);
    for (var i = 0; i < joints.length; i++) joints[i].rotation.x = i === 0 ? 0 : bend * (i / joints.length) * 0.5;
    reelHandle.parent.rotation.x += (reeling ? 10 + PF.REEL_SPEEDS[PF.Save.data.reelSpeed] * 14 : 0) * dt;

    var st = self.state;
    if (st === S.CHARGING) {
      power += powerDir * dt * 0.9;
      if (power > 1) { power = 1; powerDir = -1; }
      if (power < 0) { power = 0; powerDir = 1; }
      ui.castMeter(true, power);
      bendTarget = 0.25 * power;
      rodRoot.rotation.x = 0.55 + power * 0.6;
    } else {
      rodRoot.rotation.x = U.lerp(rodRoot.rotation.x, 0.55, dt * 8);
    }

    // Orientación de la caña hacia el pez/señuelo
    var target = fish ? fish.pos : (st === S.WAITING || st === S.BITE || st === S.FLYING ? lure : null);
    if (target) {
      var fwd = camForward();
      tip.getWorldPosition(tipPos);
      var ang = Math.atan2(target.x - tipPos.x, target.z - tipPos.z) - Math.atan2(fwd.x, fwd.z);
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      rodYaw = U.lerp(rodYaw, U.clamp(-ang, -0.7, 0.7), dt * 4);
    } else rodYaw = U.lerp(rodYaw, 0, dt * 4);
    rodRoot.rotation.y = -0.12 + rodYaw;
    tip.getWorldPosition(tipPos);

    if (st === S.FLYING) {
      flyT += dt / flyDur;
      var t = Math.min(1, flyT);
      lure.lerpVectors(lureFrom, lureTo, t);
      lure.y = U.lerp(lureFrom.y, 0, t) + Math.sin(t * Math.PI) * (2 + flyDur * 5);
      if (t >= 1) landLure();
    }

    if (st === S.WAITING || st === S.BITE) {
      waitTime += dt;
      reeling = Input.state.action && st === S.WAITING;
      var tech = self.technique;
      var bottomD = waterDepth(lure.x, lure.z);
      var gearF = PF.REEL_SPEEDS[PF.Save.data.reelSpeed];
      dart = Math.max(0, dart - dt);
      tmp2.set(tipPos.x - lure.x, 0, tipPos.z - lure.z);
      var dToRod = tmp2.length();
      tmp2.normalize();
      var moveSp = 0;
      if (reeling) moveSp = gear.reel.speed * gearF * (tech === 'lure' ? 1 : 0.7);
      if (dart > 0) moveSp += 1.6;
      lureSpeed = U.lerp(lureSpeed, moveSp, Math.min(1, dt * 6));
      lure.addScaledVector(tmp2, lureSpeed * dt);
      if (reeling && (dToRod < 3 || bottomD < 0.12)) { resetLine(); return; }
      if (reeling && nibble && !nibble.real && tech !== 'lure') { nibble = null; despawnApproach(); }

      /* --- Profundidad según técnica --- */
      if (tech === 'float') {
        var fd = Math.min(PF.Save.data.floatDepth, bottomD - 0.08);
        lureDepth = U.lerp(lureDepth, fd, dt * 2.5);
      } else if (tech === 'bottom') {
        lureDepth = U.lerp(lureDepth, bottomD - 0.05, dt * 1.8);
      } else {
        // Física de señuelo: hundimiento parado, buceo al recoger, subida si flota
        var b = gear.bait;
        var sinkV = b.sink || 0.5;
        falling = !reeling && dart <= 0 && sinkV > 0 && lureDepth < bottomD - 0.1;
        if (reeling) {
          var target = b.dive ? b.dive * Math.min(1, gearF + 0.3) : Math.max(0.15, lureDepth - gearF * 0.6 * dt * 3);
          if (b.dive) lureDepth = U.lerp(lureDepth, Math.min(target, bottomD - 0.1), dt * 1.5);
          // Señuelos sin pala: a más marcha, más suben (spinner a marcha 5 casi en superficie)
          else lureDepth = Math.max(0.1, lureDepth - (gearF * 0.22 - sinkV * 0.3) * dt);
        } else if (dart <= 0) {
          lureDepth += sinkV * dt;
        }
        lureDepth = U.clamp(lureDepth, 0, Math.max(0, bottomD - 0.06));
        if (lureDepth < 0.05 && b.sink < 0 && !reeling) lureDepth = 0;
        retrieve.update(dt, reeling, PF.Save.data.reelSpeed, lureDepth > bottomD - 0.35);
      }
      A.setReel(reeling ? 0.35 + gearF * 0.4 : 0);
      lure.y = -lureDepth;
      var ld = Math.atan2(tmp2.x, tmp2.z);
      lureYaw = ld;

      if (tech === 'float') {
        bobberDip = Math.max(0, bobberDip - dt * 1.2);
        var by = Math.sin(time * 2) * 0.015 - bobberDip * 0.4 - (st === S.BITE ? 0.22 + Math.sin(time * 25) * 0.05 : 0);
        bobber.position.set(lure.x, by, lure.z);
        bobber.rotation.z = st === S.BITE ? 0.5 : (lureDepth < PF.Save.data.floatDepth - 0.2 ? 1.2 * (1 - lureDepth / PF.Save.data.floatDepth) : 0);
      }
      lureMesh.position.set(lure.x, -lureDepth, lure.z);
      lureMesh.rotation.y = lureYaw;
      lureMesh.rotation.x = falling ? 0.6 : 0;
      if (lureMesh.userData.animate) lureMesh.userData.animate(dt, lureSpeed / 2, { dart: dart, falling: falling });
      // Puntera en fondo: vibra cuando pican
      if (tech === 'bottom') bendTarget = -0.18 - (st === S.BITE ? 0.35 + Math.sin(time * 30) * 0.1 : 0);
      else if (tech === 'lure') bendTarget = reeling ? -0.12 - gearF * 0.08 : -0.05;
      else bendTarget = -0.05;

      if (st === S.WAITING) {
        if (!nibble) rollBite(dt, hour);
        else updateNibble(dt);
        updateApproach(dt);
      } else {
        biteWindow -= dt;
        updateApproach(dt);
        if (biteWindow <= 0) {
          ui.bite(false);
          ui.toast(tech === 'lure' ? 'Ha soltado el señuelo…' : 'Se ha llevado el cebo…', 'warn');
          nibble = null; despawnApproach(); self.state = S.WAITING;
          if (gear.bait.uses != null && Math.random() < 0.5) useBait();
        }
      }
      var T = self.tele;
      T.reeling = reeling; T.slipping = false; T.lineOut = dToRod; T.depth = lureDepth; T.bottom = bottomD;
      T.style = retrieve.style; T.styleQ = retrieve.quality; T.tension = reeling ? 0.12 + gearF * 0.08 : 0.03;
      T.rodLoad = T.tension * 0.4; T.reelLoad = T.tension * 0.3; T.lineLoad = T.tension * 0.3; T.tensionKg = 0;
    }

    if (st === S.FLYING) lureMesh.position.copy(lure);
    if (st === S.IDLE || st === S.CHARGING) { var T0 = self.tele; T0.reeling = false; T0.tension = 0; T0.lineOut = 0; T0.rodLoad = T0.reelLoad = T0.lineLoad = 0; T0.style = null; }
    self.tele.gear = PF.Save.data.reelSpeed;
    if (st === S.FIGHT && fish) updateFight(dt);

    // Dibujar línea
    if (line.visible) {
      var end = fish ? fish.pos : (self.technique === 'float' && (st === S.WAITING || st === S.BITE) ? bobber.position : lure);
      var tN = fish ? U.clamp(fish.tension / Math.min(gear.line.test, gear.rod.power), 0, 1) : (reeling ? 0.6 : 0.15);
      var arr = lineGeo.attributes.position.array;
      var dd = tipPos.distanceTo(end);
      var sag = (1 - tN) * Math.min(dd * 0.05, 1.2) + 0.03;
      for (var p = 0; p < LINE_PTS; p++) {
        var u = p / (LINE_PTS - 1);
        arr[p * 3] = U.lerp(tipPos.x, end.x, u);
        arr[p * 3 + 1] = U.lerp(tipPos.y, end.y, u) - Math.sin(u * Math.PI) * sag;
        arr[p * 3 + 2] = U.lerp(tipPos.z, end.z, u);
        // La línea descansa sobre la superficie: solo el tramo final se hunde hacia el pez/señuelo
        var floor = u > 0.92 ? U.lerp(0.01, end.y, (u - 0.92) / 0.08) : 0.01;
        if (arr[p * 3 + 1] < floor) arr[p * 3 + 1] = floor;
      }
      lineGeo.attributes.position.needsUpdate = true;
      subLine.visible = self.technique === 'float' && (st === S.WAITING || st === S.BITE);
      if (subLine.visible) {
        var sa = subGeo.attributes.position.array;
        sa[0] = bobber.position.x; sa[1] = bobber.position.y; sa[2] = bobber.position.z;
        sa[3] = lure.x; sa[4] = -lureDepth; sa[5] = lure.z;
        subGeo.attributes.position.needsUpdate = true;
      }
    }

    if (heldFish) {
      heldFish.rotation.y += dt * 0.6;
      heldFish.material.userData.uni.uSwim.value = time * 3;
      heldFish.material.userData.uni.uAmp.value = 0.05;
    }
  };

  /* API de depuración (consola): PF.Game.fishing.debug.bite('rhizodus', 40) */
  this.debug = {
    bite: function (id, kg) {
      if (self.state !== S.WAITING) return 'Lanza primero';
      var sp = PF.SPECIES[id] || PF.SPECIES.rhadinichthys;
      nibble = { species: sp, kg: kg || PF.rollWeight(sp), t: 0, count: 0, next: 0, real: true, hab: zone.habitatAt(lure.x, lure.z, waterDepth(lure.x, lure.z)) };
      spawnApproach(sp, nibble.kg);
      hook();
      return 'ok';
    },
    get fish() { return fish; }
  };

  this.setRodVisible = function (v) { rodRoot.visible = v; };
  this.canMove = function () { return self.state === S.IDLE; };
  refreshGear();
};
