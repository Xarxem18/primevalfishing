/* =====================================================================
   PRIMEVAL FISHING — MODELOS DE SEÑUELOS / CEBOS / BOYA
   ---------------------------------------------------------------------
   PF.Lures.build(bait) devuelve un THREE.Group con:
     group.userData.animate(dt, speed, state)  -> anima según el tipo
       spinner: la pala gira con la velocidad
       spoon:   cabeceo/balanceo (wobble)
       minnow/jerk: serpenteo lateral; el jerk da "flashes" en el tirón
       jig:     la cola vibra al caer
       swim:    cola articulada
   Estética "prehistórica": hueso, ámbar, piedra pulida, nácar.
   Orientación: el señuelo avanza hacia +Z local.
   ===================================================================== */
window.PF = window.PF || {};

PF.Lures = (function () {
  function mat(color, shiny) {
    return new THREE.MeshPhongMaterial({ color: color, shininess: shiny ? 90 : 30, specular: shiny ? '#fff4d0' : '#333' });
  }
  var hookMat = new THREE.MeshPhongMaterial({ color: '#d8ccaa', shininess: 60 });

  function hook(scale, z) {
    var h = new THREE.Mesh(new THREE.TorusGeometry(0.018 * scale, 0.004 * scale, 4, 10, Math.PI * 1.4), hookMat);
    h.position.set(0, -0.018 * scale, z);
    h.rotation.y = Math.PI / 2;
    return h;
  }

  function fishBody(len, depth, color, lip) {
    var g = new THREE.Group();
    var b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(color, true));
    b.scale.set(depth * 0.45, depth, len / 2);
    g.add(b);
    var back = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(new THREE.Color(color).multiplyScalar(0.55)));
    back.scale.set(depth * 0.47, depth * 1.02, len / 2 * 1.01);
    g.add(back);
    [1, -1].forEach(function (s) {
      var e = new THREE.Mesh(new THREE.SphereGeometry(depth * 0.18, 6, 5), mat('#d9a441', true));
      e.position.set(s * depth * 0.38, depth * 0.25, len * 0.33);
      g.add(e);
    });
    if (lip) {
      var l = new THREE.Mesh(new THREE.PlaneGeometry(depth * 0.9, depth * 1.1), new THREE.MeshPhongMaterial({ color: '#f0e2b0', transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      l.position.set(0, -depth * 0.5, len * 0.55);
      l.rotation.x = -0.9;
      g.add(l);
    }
    var tail = new THREE.Mesh(new THREE.ConeGeometry(depth * 0.7, len * 0.25, 4), mat(color));
    tail.rotation.x = -Math.PI / 2; tail.position.z = -len * 0.55; tail.scale.x = 0.25;
    g.add(tail);
    g.userData.tail = tail;
    return g;
  }

  function build(bait) {
    var root = new THREE.Group();
    var inner = new THREE.Group();
    root.add(inner);
    var type = bait.lureType || 'natural';
    var c = bait.color, t = 0;
    var anim;

    if (type === 'spinner') {
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6), mat('#8a6a3a', true));
      body.rotation.x = Math.PI / 2; inner.add(body);
      var bladePivot = new THREE.Group(); bladePivot.position.z = 0.05; inner.add(bladePivot);
      var blade = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 4, 0, Math.PI * 2, 0, 0.9), mat(c, true));
      blade.scale.set(1, 0.25, 1.6); blade.position.set(0.022, 0, 0); blade.rotation.z = Math.PI / 2;
      bladePivot.add(blade);
      inner.add(hook(1, -0.05));
      anim = function (dt, sp) { bladePivot.rotation.z += dt * (sp * 40 + 1); };
    } else if (type === 'spoon') {
      // Cuchara: elipsoide muy aplanado (cuenco) de ámbar pulido
      var sp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(c, true));
      sp.scale.set(0.75, 0.18, 1.6);
      inner.add(sp);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 4, 8), hookMat);
      ring.position.z = 0.075; inner.add(ring);
      inner.add(hook(1.2, -0.08));
      anim = function (dt, s) { t += dt * (4 + s * 14); inner.rotation.z = Math.sin(t) * (0.3 + s * 0.6); inner.rotation.y = Math.sin(t * 0.5) * 0.2; };
    } else if (type === 'minnow' || type === 'jerk' || type === 'swim') {
      var L = type === 'swim' ? 0.18 : type === 'jerk' ? 0.11 : 0.09;
      var fb = fishBody(L, L * 0.2, c, type !== 'swim');
      inner.add(fb);
      inner.add(hook(1.1, -L * 0.1));
      inner.add(hook(1.1, L * 0.25));
      anim = function (dt, s, st) {
        t += dt * (6 + s * 18);
        var amp = type === 'swim' ? 0.35 : 0.18;
        inner.rotation.y = Math.sin(t) * amp * (0.3 + s);
        if (fb.userData.tail) fb.userData.tail.rotation.y = Math.sin(t * 1.5) * 0.6;
        if (st && st.dart > 0) inner.rotation.z = Math.sin(st.dart * 30) * 0.9;
      };
    } else if (type === 'jig') {
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#e0d4b0', true));
      head.position.z = 0.03; inner.add(head);
      var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), mat('#c4502a'));
      e1.position.set(0.016, 0.006, 0.04); inner.add(e1);
      var e2 = e1.clone(); e2.position.x = -0.016; inner.add(e2);
      var tailJ = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.08, 6), mat(c));
      tailJ.rotation.x = -Math.PI / 2; tailJ.position.z = -0.025; inner.add(tailJ);
      inner.add(hook(1.2, 0.0));
      anim = function (dt, s, st) { t += dt * 14; tailJ.rotation.y = Math.sin(t) * (st && st.falling ? 0.7 : 0.25); };
    } else {
      // Cebo natural en anzuelo (gusano / crustáceo / pez)
      var bm = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.012, 0.05, 3, 6) : new THREE.SphereGeometry(0.03, 6, 5), mat(c));
      bm.rotation.z = 0.6; inner.add(bm);
      inner.add(hook(1, 0));
      anim = function (dt) { t += dt * 3; bm.rotation.z = 0.6 + Math.sin(t) * 0.3; };
    }
    root.userData.animate = anim;
    return root;
  }

  /* Boya pintada (rojo ocre + hueso) con antena */
  function bobber() {
    var g = new THREE.Group();
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#e8572a', emissive: '#401000', shininess: 60 }));
    var bot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#efe6cc', shininess: 60 }));
    bot.scale.y = 1.6;
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 5), new THREE.MeshBasicMaterial({ color: '#ffb040' }));
    stick.position.y = 0.17;
    g.add(top, bot, stick);
    return g;
  }

  return { build: build, bobber: bobber };
})();
