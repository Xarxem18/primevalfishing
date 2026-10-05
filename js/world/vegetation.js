/* =====================================================================
   PRIMEVAL FISHING — VEGETACIÓN Y DECORADO (Carbonífero)
   ---------------------------------------------------------------------
   Flora del Viseano: NO hay plantas con flor ni hierba moderna.
   - Lepidodendron: "árbol escamoso" licopsida, tronco recto con patrón
     romboidal y copa bifurcada.
   - Calamites: equisetos gigantes, tallos segmentados con verticilos.
   - Helechos y pteridospermas (helechos con semilla) en el sotobosque.
   - "Juncos" = equisetos jóvenes y licopodios en la orilla.
   - Esteras de algas flotantes en vez de nenúfares (no existían).
   Todo se dibuja con InstancedMesh: 1 draw call por tipo.
   El viento se aplica en el vertex shader (onBeforeCompile) según la
   altura local del vértice, así no cuesta CPU.
   ===================================================================== */
window.PF = window.PF || {};

PF.Vegetation = function (scene, zone, quality) {
  var U = PF.Util, G = PF.Geo;
  var pal = zone.palette;
  var rnd = U.rng(1337);
  var self = this;
  this.windUniform = { value: 0 };
  this.colliders = []; // troncos grandes (para que el jugador no los atraviese)

  function windMaterial(strength) {
    var m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    var wu = self.windUniform;
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uWind = wu;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  float ph = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.07;',
          '#else',
          '  float ph = 0.0;',
          '#endif',
          '  float sway = sin(uWind * 1.6 + ph) * 0.6 + sin(uWind * 3.1 + ph * 2.0) * 0.25;',
          '  transformed.x += sway * ' + strength.toFixed(3) + ' * max(position.y, 0.0) * max(position.y, 0.0);',
          '  transformed.z += sway * ' + (strength * 0.5).toFixed(3) + ' * max(position.y, 0.0) * max(position.y, 0.0);'
        ].join('\n'));
    };
    return m;
  }

  /* ---------- Modelos ---------- */
  function makeLepidodendron() {
    var parts = [];
    var bark = new THREE.Color('#6b5a3c'), barkDark = new THREE.Color('#4e4029');
    var trunk = new THREE.CylinderGeometry(0.45, 0.85, 16, 8, 8);
    trunk.translate(0, 8, 0);
    // Patrón romboidal (cicatrices foliares) pintado con bandas diagonales
    parts.push(G.paint(trunk, function (x, y, z, c) {
      var a = Math.atan2(z, x);
      var d = Math.sin(a * 4 + y * 1.6) * Math.sin(a * 4 - y * 1.6);
      c.copy(d > 0.25 ? barkDark : bark);
      c.offsetHSL(0, 0, (y / 16) * 0.05);
    }));
    // Copa dicotómica: ramas que se bifurcan
    var leaf = new THREE.Color('#5d6e2c');
    function branch(x, y, z, ang, tilt, len, depth) {
      var b = new THREE.CylinderGeometry(0.12 * depth, 0.2 * depth, len, 5);
      b.translate(0, len / 2, 0);
      G.xf(b, x, y, z, 0, ang, tilt);
      parts.push(G.paint(b, '#5e4c33'));
      var ex = x + Math.sin(tilt) * -Math.cos(ang) * len * -1, ey = y + Math.cos(tilt) * len;
      var tipX = x - Math.sin(tilt) * Math.cos(ang) * len, tipZ = z + Math.sin(tilt) * Math.sin(ang) * len;
      if (depth > 1) {
        branch(tipX, ey, tipZ, ang + 0.6, tilt + 0.25, len * 0.75, depth - 1);
        branch(tipX, ey, tipZ, ang - 0.6, tilt - 0.15, len * 0.75, depth - 1);
      } else {
        // Penacho de hojas lineales (pom-pom de licopsida)
        var tuft = new THREE.SphereGeometry(1.4, 7, 5);
        tuft.scale(1, 1.25, 1);
        G.xf(tuft, tipX, ey + 0.4, tipZ);
        parts.push(G.paint(tuft, function (x2, y2, z2, c) { c.copy(leaf).offsetHSL(0, 0, (y2 - ey) * 0.03); }));
      }
    }
    branch(0, 15.5, 0, 0, 0.55, 3.2, 3);
    branch(0, 15.5, 0, Math.PI, 0.5, 3.0, 3);
    branch(0, 15.5, 0, Math.PI / 2, 0.45, 2.6, 2);
    return G.merge(parts);
  }

  function makeCalamites() {
    var parts = [];
    var segs = 7, h = 7;
    for (var i = 0; i < segs; i++) {
      var s = new THREE.CylinderGeometry(0.22, 0.26, h / segs, 7, 1);
      s.translate(0, (i + 0.5) * h / segs, 0);
      parts.push(G.paint(s, i % 2 ? '#6f7a3a' : '#66713a'));
      // Nudo + verticilo de hojas finas
      var ny = (i + 1) * h / segs;
      var ring = new THREE.TorusGeometry(0.25, 0.05, 4, 8);
      G.xf(ring, 0, ny, 0, Math.PI / 2, 0, 0);
      parts.push(G.paint(ring, '#4f5a2a'));
      if (i > 1) {
        for (var k = 0; k < 6; k++) {
          var f = G.frond(1.2 - i * 0.05, 0.05, 0.4, 2);
          G.xf(f, 0, ny, 0, -0.3, k / 6 * Math.PI * 2, 0);
          parts.push(G.paint(f, '#7c8a3c'));
        }
      }
    }
    return G.merge(parts);
  }

  function makeFern() {
    var parts = [];
    for (var k = 0; k < 7; k++) {
      var f = G.frond(1.8 + rnd() * 0.5, 0.32, 0.55, 6);
      G.xf(f, 0, 0.05, 0, -0.75 - rnd() * 0.3, k / 7 * Math.PI * 2 + rnd() * 0.3, 0);
      parts.push(G.paint(f, function (x, y, z, c) { c.set('#6d7d30').offsetHSL(0, 0, Math.hypot(x, z) * -0.04); }));
    }
    return G.merge(parts);
  }

  function makeReed() {
    var parts = [];
    for (var k = 0; k < 6; k++) {
      var hh = 1.2 + rnd() * 1.4;
      var r = new THREE.CylinderGeometry(0.02, 0.05, hh, 4);
      r.translate(0, hh / 2, 0);
      G.xf(r, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
      parts.push(G.paint(r, function (x, y, z, c) { c.set('#8a8c44').lerp(new THREE.Color('#c0a860'), y / 2.6); }));
      // Estróbilo (cono reproductor) en la punta de algunos
      if (k % 2 === 0) {
        var cone = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 5);
        cone.translate(0, hh + 0.1, 0);
        parts.push(G.paint(cone, '#7a5a30'));
      }
    }
    return G.merge(parts);
  }

  /* Roca: icosaedro subdividido. La deformación se calcula a partir de la
     POSICIÓN del vértice (no de su índice): así los vértices compartidos
     entre caras se mueven igual y no aparecen grietas (bug v0.1). */
  function makeRock() {
    var g = new THREE.IcosahedronGeometry(1, 1);
    var p = g.attributes.position;
    var v = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      var n = U.noise(v.x * 1.7 + 3.1, v.z * 1.7 + v.y * 1.3) * 0.22 + U.noise(v.x * 3.3, v.y * 3.3 - v.z) * 0.08;
      v.multiplyScalar(1 + n);
      v.y = v.y > 0 ? v.y * 0.62 : v.y * 0.35;   // base aplanada, enterrada
      if (v.y > 0.45) v.y = 0.45 + (v.y - 0.45) * 0.3; // cima erosionada plana
      p.setXYZ(i, v.x * 1.15, v.y, v.z);
    }
    g.computeVertexNormals();
    var rc = new THREE.Color(pal.rock), mossC = new THREE.Color(pal.moss), dark = new THREE.Color(pal.rock).multiplyScalar(0.7);
    // Color plano por cara (look low-poly pintado) + musgo en la parte alta
    var out = G.paint(g, function (x, y, z, c) {
      c.copy(rc).lerp(dark, U.smooth(0.1, -0.3, y));
      c.offsetHSL(0, 0, U.noise(x * 2, z * 2) * 0.04);
      if (y > 0.3) c.lerp(mossC, U.smooth(0.3, 0.45, y) * 0.65);
    });
    out.computeVertexNormals();
    return out;
  }

  function makeLog() {
    var parts = [];
    var l = new THREE.CylinderGeometry(0.55, 0.65, 9, 8);
    G.xf(l, 0, 0.3, 0, 0, 0, Math.PI / 2);
    parts.push(G.paint(l, function (x, y, z, c) { var a = Math.atan2(z, y); c.set(Math.sin(a * 4 + x * 1.5) * Math.sin(a * 4 - x * 1.5) > 0.2 ? '#4e4029' : '#6b5a3c'); }));
    var st = new THREE.CylinderGeometry(0.15, 0.22, 1.6, 5);
    G.xf(st, 2, 0.8, 0, 0.5, 0, 0.6);
    parts.push(G.paint(st, '#5e4c33'));
    return G.merge(parts);
  }

  function makeAlgae() {
    var g = new THREE.CircleGeometry(1, 9);
    g.rotateX(-Math.PI / 2);
    var p = g.attributes.position;
    for (var i = 1; i < p.count; i++) { var s = 0.7 + U.hash(i, 11) * 0.5; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
    return G.paint(g, function (x, y, z, c) { c.set('#7a8a3a').offsetHSL(0, 0, -Math.hypot(x, z) * 0.06); });
  }

  /* ---------- Colocación ---------- */
  var dummy = new THREE.Object3D();
  function place(geo, mat, count, sampler, minS, maxS, castFn) {
    var placed = [];
    var tries = 0;
    while (placed.length < count && tries < count * 40) {
      tries++;
      var p = sampler();
      if (!p) continue;
      placed.push(p);
    }
    var im = new THREE.InstancedMesh(geo, mat, placed.length);
    for (var i = 0; i < placed.length; i++) {
      var p2 = placed[i];
      var s = minS + rnd() * (maxS - minS);
      dummy.position.set(p2.x, p2.y, p2.z);
      dummy.rotation.set((rnd() - 0.5) * 0.08, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.08);
      dummy.scale.set(s, s * (0.85 + rnd() * 0.3), s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (castFn) castFn(p2, s);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    return im;
  }

  function sampleLand(minD, maxD, xRange) {
    return function () {
      var x = (rnd() * 2 - 1) * (xRange || 300);
      var sz = zone.shoreZ(x);
      var z = sz + minD + rnd() * (maxD - minD);
      var y = zone.heightAt(x, z);
      if (y < 0.25) return null;
      // Mantener despejados los puestos de pesca
      for (var i = 0; i < zone.spots.length; i++) {
        var s = zone.spots[i];
        if (Math.hypot(x - s.x, z - s.z) < 9) return null;
      }
      return { x: x, y: y - 0.1, z: z };
    };
  }

  function sampleFarShore() {
    var x = (rnd() * 2 - 1) * 330;
    var z = -230 + 18 * Math.sin(x * 0.017 + 0.7) - 8 - rnd() * 70;
    var y = zone.heightAt(x, z);
    if (y < 0.3) return null;
    return { x: x, y: y - 0.2, z: z };
  }

  var V = zone.vegetation;
  var q = quality.low ? 0.55 : 1;
  var solid = new THREE.MeshLambertMaterial({ vertexColors: true });

  var lepiGeo = makeLepidodendron();
  var colliders = self.colliders;
  place(lepiGeo, windMaterial(0.0008), Math.round(V.lepidodendron * q), sampleLand(14, 120), 0.8, 1.35, function (p, s) { colliders.push({ x: p.x, z: p.z, r: 0.9 * s }); });
  place(lepiGeo, solid, Math.round(V.lepidodendron * 1.2 * q), sampleFarShore, 0.9, 1.6);
  place(makeCalamites(), windMaterial(0.004), Math.round(V.calamites * q), sampleLand(3, 70), 0.7, 1.5);
  place(makeFern(), windMaterial(0.05), Math.round(V.fern * q), sampleLand(2, 90), 0.6, 1.4);
  place(makeReed(), windMaterial(0.06), Math.round(V.reed * q), function () {
    // Juncos de licopodio en la línea de agua y en los herbazales
    var x = (rnd() * 2 - 1) * 280, z;
    if (rnd() < 0.7) z = zone.shoreZ(x) + (rnd() * 6 - 3.5);
    else { var w = zone.weeds[Math.floor(rnd() * zone.weeds.length)]; var a = rnd() * 6.28, rr = rnd() * w.r * 0.8; x = w.x + Math.cos(a) * rr; z = w.z + Math.sin(a) * rr; }
    var y = zone.heightAt(x, z);
    if (y < -1.3) return null;
    for (var i = 0; i < zone.spots.length; i++) if (Math.hypot(x - zone.spots[i].x, z - zone.spots[i].z) < 3.5) return null;
    return { x: x, y: y, z: z };
  }, 0.8, 1.3);
  place(makeRock(), solid, Math.round(V.rock * q), function () {
    var x = (rnd() * 2 - 1) * 300, z = zone.shoreZ(x) + (rnd() * 40 - 6);
    var y = zone.heightAt(x, z);
    if (y < -1.2) return null;
    for (var i = 0; i < zone.spots.length; i++) if (Math.hypot(x - zone.spots[i].x, z - zone.spots[i].z) < 8) return null;
    return { x: x, y: y - 0.1, z: z };
  }, 0.4, 2.2);
  place(makeLog(), solid, V.log, function () {
    var x = (rnd() * 2 - 1) * 220, z = zone.shoreZ(x) + (rnd() * 12 - 4);
    var y = zone.heightAt(x, z);
    for (var i = 0; i < zone.spots.length; i++) if (Math.hypot(x - zone.spots[i].x, z - zone.spots[i].z) < 7) return null;
    return { x: x, y: Math.max(y, -0.35), z: z };
  }, 0.8, 1.2);
  var algaeMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
  var algae = place(makeAlgae(), algaeMat, Math.round(V.lily * q), function () {
    var w = zone.weeds[Math.floor(rnd() * zone.weeds.length)];
    var a = rnd() * 6.28, rr = Math.sqrt(rnd()) * w.r;
    return { x: w.x + Math.cos(a) * rr, y: 0.03, z: w.z + Math.sin(a) * rr };
  }, 0.5, 1.4);
  algae.renderOrder = 3;

  this.update = function (time) { self.windUniform.value = time; };
};
