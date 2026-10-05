/* =====================================================================
   PRIMEVAL FISHING — GENERADOR PROCEDURAL DE PECES (v0.2)
   ---------------------------------------------------------------------
   Cambios v0.2 (feedback: "los peces son feos"):
     - Normales SUAVES (se calculan sobre la malla indexada).
     - Sección transversal tipo "superelipse" (lomo redondeado, vientre
       algo aplanado) y perfil aerodinámico con pedúnculo caudal claro.
     - Escamas ganoideas ROMBOIDALES pintadas por vértice (característica
       real de paleonisciformes y sarcopterigios del Carbonífero).
     - Contrasombreado (lomo oscuro / flancos / vientre claro), línea
       lateral, opérculo, boca y ojos 3D (esclerótica ámbar + pupila).
     - Aletas como abanicos con radios (rayas) y borde oscurecido.
     - Material Phong con brillo bajo = aspecto mojado.
   Ejes: cabeza en +Z, lomo en +Y. Longitud base = 1 unidad.
   La ondulación al nadar se hace en el vertex shader (uSwim, uAmp).
   ===================================================================== */
window.PF = window.PF || {};

PF.FishMesh = (function () {
  var G = PF.Geo;
  var cache = {};

  /* Perfil vertical (semialtura) en función de t (0 cola -> 1 hocico) */
  function heightProfile(t, look) {
    // Perfil hidrodinámico: u^a (1-u)^b normalizado -> máximo hacia el 55-60 %
    // del cuerpo y hocico apuntado (antes era romo, feedback v0.1).
    var ped = 0.12;
    if (t < ped) return 0.24 + (t / ped) * 0.12;
    var u = (t - ped) / (1 - ped);
    var a = 0.6, b = look.snout > 1 ? 1.05 : 0.85;
    var peak = a / (a + b);
    var norm = Math.pow(peak, a) * Math.pow(1 - peak, b);
    var h = Math.pow(u, a) * Math.pow(Math.max(0, 1 - u), b) / norm;
    return Math.max(0.36 * (1 - u) + 0.02, h);
  }

  function bodyGeo(look) {
    var RINGS = 30, SEG = 18;
    var D = look.depth || 0.2, W = D * (look.depth > 0.35 ? 0.32 : 0.48);
    var snout = look.snout || 1;
    var top = new THREE.Color(look.top), belly = new THREE.Color(look.belly);
    var side = top.clone().lerp(belly, 0.45).offsetHSL(0, 0.05, 0.06);
    var dark = top.clone().multiplyScalar(0.55);
    var lateral = belly.clone().lerp(new THREE.Color('#ffffff'), 0.25);
    var pos = [], col = [], idx = [];
    var c = new THREE.Color();
    for (var i = 0; i <= RINGS; i++) {
      var t = i / RINGS;
      var z = (t - 0.5) * (t > 0.8 ? 1 + (snout - 1) * (t - 0.8) * 1.6 : 1);
      var hp = heightProfile(t, look);
      if (i === RINGS) hp = 0.02;
      var h = D * 0.5 * hp, w = W * 0.5 * hp;
      // La cabeza se estrecha más en anchura (hocico afilado)
      if (t > 0.85) w *= 1 - (t - 0.85) * 2.2;
      for (var j = 0; j < SEG; j++) {
        var a = j / SEG * Math.PI * 2;
        var ca = Math.cos(a), sa = Math.sin(a);
        // Superelipse: lomo redondeado, vientre ligeramente plano
        var ex = sa < 0 ? 2.4 : 2.0;
        var x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / ex) * w;
        var y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / ex) * h - (sa < 0 ? h * 0.06 : 0);
        pos.push(x, y, z);

        /* --- Color --- */
        var up = (sa + 1) / 2; // 0 vientre, 1 lomo
        if (up > 0.6) c.copy(side).lerp(top, (up - 0.6) / 0.4);
        else c.copy(belly).lerp(side, Math.pow(up / 0.6, 1.6));
        // Escamas romboidales ganoideas (rejilla diagonal)
        var gu = t * 34, gv = (a / (Math.PI * 2)) * 22;
        var fu = gu + gv, fv = gu - gv;
        var edge = Math.min(Math.abs(fu - Math.round(fu)), Math.abs(fv - Math.round(fv)));
        if (t > 0.1 && t < 0.77 && edge < 0.1) c.multiplyScalar(look.pattern === 'plain' ? 0.94 : 0.88);
        // Patrones de especie
        // Manchas: pequeñas y nítidas (umbral alto) solo en lomo/flancos
        if (look.pattern === 'spots' && up > 0.5 && t > 0.08 && t < 0.85 && Math.sin(t * 61 + j * 1.7) * Math.sin(a * 9 + t * 13) > 0.82) c.lerp(dark, 0.6);
        // Rayas longitudinales finas en el flanco superior
        if (look.pattern === 'stripes' && up > 0.55 && up < 0.8 && Math.abs(Math.sin(a * 6)) < 0.25) c.lerp(dark, 0.35);
        // Línea lateral
        if (Math.abs(sa) < 0.07 && t > 0.15 && t < 0.78) c.lerp(lateral, 0.5);
        // Brillo de cosmina (sarcopterigios)
        if (look.shine && up > 0.35 && up < 0.65) c.offsetHSL(0.02, 0.05, 0.07);
        // Opérculo (borde de agallas) y cabeza algo más oscura
        // Opérculo: arco sutil solo en los flancos (antes era un anillo completo)
        if (t > 0.765 && t < 0.79 && Math.abs(ca) > 0.45 && up > 0.2) c.multiplyScalar(0.8);
        // Cabeza: placas dérmicas lisas, sin escamas, algo más oscura arriba
        if (t > 0.79) c.lerp(top, up > 0.55 ? 0.2 : 0.0);
        // Boca: línea oscura en el hocico
        if (t > 0.9 && Math.abs(sa + 0.25) < 0.08) c.multiplyScalar(0.45);
        col.push(c.r, c.g, c.b);
        if (i < RINGS) {
          var a0 = i * SEG + j, a1 = i * SEG + (j + 1) % SEG, b0 = a0 + SEG, b1 = a1 + SEG;
          idx.push(a0, a1, b0, a1, b1, b0);
        }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();      // normales suaves (antes de des-indexar)
    return g.toNonIndexed();
  }

  /* Aleta en abanico: base (b0,b1) y contorno; radios pintados */
  function fin(base0, base1, outline, color, opts) {
    opts = opts || {};
    var pos = [], col = [];
    var c0 = new THREE.Color(color), cEdge = c0.clone().multiplyScalar(0.55), cRay = c0.clone().multiplyScalar(0.75);
    var n = outline.length;
    for (var k = 0; k < n - 1; k++) {
      var f0 = k / (n - 1), f1 = (k + 1) / (n - 1);
      var bA = [base0[0] + (base1[0] - base0[0]) * f0, base0[1] + (base1[1] - base0[1]) * f0, base0[2] + (base1[2] - base0[2]) * f0];
      var bB = [base0[0] + (base1[0] - base0[0]) * f1, base0[1] + (base1[1] - base0[1]) * f1, base0[2] + (base1[2] - base0[2]) * f1];
      var oA = outline[k], oB = outline[k + 1];
      pos.push.apply(pos, bA.concat(oA, oB, bA, oB, bB));
      var ray = k % 2 ? cRay : c0;
      [c0, cEdge, cEdge, c0, cEdge, c0].forEach(function (cc, ii) { var u = ii === 0 || ii === 3 || ii === 5 ? c0 : (k % 2 ? cEdge : ray.clone().lerp(cEdge, 0.5)); col.push(u.r, u.g, u.b); });
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  function sphere(r, x, y, z, color, sx, sy, sz) {
    var s = new THREE.SphereGeometry(r, 8, 6);
    s.scale(sx || 1, sy || 1, sz || 1);
    s.translate(x, y, z);
    return G.paint(s, color);
  }

  function build(look) {
    var D = look.depth || 0.2;
    var H = D * 0.5;            // semialtura máx.
    var W = D * (look.depth > 0.35 ? 0.32 : 0.48) * 0.5;
    var finC = look.fin;
    var parts = [bodyGeo(look)];
    var tz = -0.5;
    var hPed = H * 0.2;

    /* ---- Cola ---- */
    if (look.tail === 'hetero' || look.tail === 'shark') {
      // Lóbulo superior largo (heterocerca), típico de paleoniscos y tiburones
      var up = look.tail === 'shark' ? 1.25 : 1.0;
      parts.push(fin([0, hPed, tz + 0.05], [0, -hPed, tz + 0.05], [
        [0, hPed + H * 0.15, tz - 0.02], [0, H * 1.1 * up, tz - 0.2], [0, H * 1.25 * up, tz - 0.27],
        [0, H * 0.6, tz - 0.2], [0, H * 0.05, tz - 0.12], [0, -H * 0.55, tz - 0.16], [0, -H * 0.75, tz - 0.13], [0, -hPed, tz + 0.02]
      ], finC));
    } else {
      // Dificerca (sarcopterigios/dipnoos): simétrica, en punta de lanza
      parts.push(fin([0, hPed, tz + 0.12], [0, -hPed, tz + 0.12], [
        [0, H * 0.45, tz + 0.04], [0, H * 0.55, tz - 0.06], [0, H * 0.25, tz - 0.16], [0, 0, tz - 0.22],
        [0, -H * 0.25, tz - 0.16], [0, -H * 0.55, tz - 0.06], [0, -H * 0.45, tz + 0.04]
      ], finC));
    }

    /* ---- Dorsal(es) ---- */
    if (look.lobed) {
      parts.push(fin([0, H * 0.85, 0.02], [0, H * 0.8, -0.1], [[0, H * 0.9, 0.03], [0, H * 1.5, -0.02], [0, H * 1.45, -0.08], [0, H * 0.82, -0.11]], finC));
      parts.push(fin([0, H * 0.6, -0.2], [0, H * 0.5, -0.3], [[0, H * 0.62, -0.19], [0, H * 1.15, -0.24], [0, H * 1.05, -0.3], [0, H * 0.5, -0.31]], finC));
    } else {
      // Paleoniscos: dorsal única retrasada, triangular
      parts.push(fin([0, H * 0.75, -0.04], [0, H * 0.55, -0.2], [[0, H * 0.78, -0.03], [0, H * 1.55, -0.1], [0, H * 1.2, -0.17], [0, H * 0.55, -0.21]], finC));
    }
    /* ---- Anal ---- */
    parts.push(fin([0, -H * 0.6, -0.12], [0, -H * 0.45, -0.26], [[0, -H * 0.62, -0.11], [0, -H * 1.25, -0.18], [0, -H * 1.0, -0.25], [0, -H * 0.45, -0.27]], finC));

    /* ---- Pares: pectorales y pélvicas ---- */
    [1, -1].forEach(function (s) {
      if (look.lobed) {
        // Lóbulo carnoso (huesos internos) + aleta en el extremo
        parts.push(sphere(1, s * W * 0.95, -H * 0.55, 0.22, look.top, 0.025, 0.02, 0.085));
        parts.push(fin([s * W * 1.0, -H * 0.62, 0.18], [s * W * 1.0, -H * 0.6, 0.12], [[s * W * 1.1, -H * 0.66, 0.17], [s * (W + 0.07), -H * 1.0, 0.1], [s * (W + 0.05), -H * 0.95, 0.05], [s * W * 1.0, -H * 0.62, 0.1]], finC));
        parts.push(sphere(1, s * W * 0.7, -H * 0.75, -0.12, look.top, 0.02, 0.017, 0.065));
        parts.push(fin([s * W * 0.75, -H * 0.8, -0.15], [s * W * 0.7, -H * 0.8, -0.19], [[s * W * 0.8, -H * 0.85, -0.15], [s * (W * 0.8 + 0.05), -H * 1.15, -0.21], [s * W * 0.75, -H * 0.85, -0.23]], finC));
      } else {
        parts.push(fin([s * W * 0.9, -H * 0.45, 0.24], [s * W * 0.8, -H * 0.55, 0.19], [[s * W * 1.0, -H * 0.45, 0.23], [s * (W + 0.1), -H * 0.95, 0.12], [s * (W + 0.06), -H * 1.05, 0.09], [s * W * 0.8, -H * 0.6, 0.18]], finC));
        parts.push(fin([s * W * 0.6, -H * 0.8, -0.06], [s * W * 0.55, -H * 0.82, -0.12], [[s * W * 0.7, -H * 0.85, -0.06], [s * (W * 0.6 + 0.06), -H * 1.25, -0.13], [s * W * 0.55, -H * 0.88, -0.15]], finC));
      }
    });

    /* ---- Espinas (acantodios, ctenacántidos, xenacántidos) ---- */
    var bone = '#e8dcb8';
    if (look.spines) {
      [1, -1].forEach(function (s) { parts.push(fin([s * W, -H * 0.5, 0.25], [s * W, -H * 0.6, 0.22], [[s * W, -H * 0.5, 0.25], [s * (W + 0.1), -H * 1.3, 0.05], [s * W, -H * 0.6, 0.21]], bone)); });
      parts.push(fin([0, H * 0.8, -0.02], [0, H * 0.75, -0.06], [[0, H * 0.82, -0.01], [0, H * 1.9, -0.1], [0, H * 0.75, -0.07]], bone));
    }
    if (look.dorsalSpine) parts.push(fin([0, H * 0.9, 0.14], [0, H * 0.85, 0.08], [[0, H * 0.92, 0.15], [0, H * 1.9, 0.02], [0, H * 0.85, 0.07]], bone));
    if (look.headSpine) parts.push(fin([0, H * 0.75, 0.32], [0, H * 0.7, 0.27], [[0, H * 0.8, 0.33], [0, H * 1.25, 0.05], [0, H * 0.7, 0.26]], bone));
    if (look.fangs) {
      [1, -1].forEach(function (s) {
        parts.push(fin([s * W * 0.25, -H * 0.15, 0.48], [s * W * 0.25, -H * 0.15, 0.45], [[s * W * 0.25, -H * 0.15, 0.48], [s * W * 0.22, -H * 0.6, 0.465], [s * W * 0.25, -H * 0.15, 0.45]], bone));
      });
    }

    /* ---- Ojos: colocados sobre la superficie real de la cabeza ---- */
    var te = 0.885, sn = look.snout || 1;
    var hpE = heightProfile(te, look);
    var eyeZ = (te - 0.5) * (1 + (sn - 1) * (te - 0.8) * 1.6);
    var hE = H * hpE, wE = W * hpE * (1 - (te - 0.85) * 2.2);
    var eyeR = Math.max(0.014, hE * 0.3);
    [1, -1].forEach(function (s) {
      var ex = s * wE * 0.98, ey = hE * 0.28;
      parts.push(sphere(eyeR, ex, ey, eyeZ, '#d9a441', 0.55, 1, 1));
      parts.push(sphere(eyeR * 0.62, ex + s * eyeR * 0.3, ey, eyeZ + eyeR * 0.05, '#0d0a06', 0.5, 1, 1));
    });
    return G.merge(parts);
  }

  function getGeometry(species) {
    if (!cache[species.id]) cache[species.id] = build(species.look);
    return cache[species.id];
  }

  /* Material con ondulación lateral (la amplitud crece hacia la cola) */
  function makeMaterial(opts) {
    var sil = opts && opts.silhouette;
    var m = sil
      ? new THREE.MeshBasicMaterial({ color: '#141810', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 38, specular: new THREE.Color('#5a5444') });
    var uni = { uSwim: { value: 0 }, uAmp: { value: 0.12 } };
    m.userData.uni = uni;
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uSwim = uni.uSwim;
      shader.uniforms.uAmp = uni.uAmp;
      shader.vertexShader = 'uniform float uSwim; uniform float uAmp;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '  float k = clamp(0.35 - position.z, 0.0, 1.0);',
          '  transformed.x += sin(uSwim - position.z * 6.0) * uAmp * k * k;'
        ].join('\n'));
    };
    return m;
  }

  function create(species, opts) {
    var mesh = new THREE.Mesh(getGeometry(species), makeMaterial(opts));
    mesh.userData.species = species;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* Escala visual a partir del peso: L ~ (kg/k)^(1/3) */
  function lengthForKg(species, kg) {
    var k = species.look.depth > 0.35 ? 22 : 11;
    return Math.max(0.12, Math.cbrt(kg / k) * 1.15);
  }

  return { create: create, lengthForKg: lengthForKg, getGeometry: getGeometry };
})();
