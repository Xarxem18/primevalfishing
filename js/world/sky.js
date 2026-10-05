/* =====================================================================
   PRIMEVAL FISHING — CIELO, HORIZONTE Y CICLO DÍA/NOCHE
   ---------------------------------------------------------------------
   - Cúpula de cielo con gradiente (shader barato, sin texturas).
   - Tres capas de montañas en anillo con perspectiva atmosférica: cuanto
     más lejos, más claras y cálidas (se funden con la niebla). Es la
     técnica principal que da profundidad "de pintura" al horizonte.
   - Un volcán humeante: el Carbonífero de Edimburgo era volcánico
     (Arthur's Seat es un volcán de esa edad). Justificación en el doc.
   - Ciclo día/noche con paletas clave interpoladas (KEYS).
   ===================================================================== */
window.PF = window.PF || {};

PF.Sky = function (scene, zone, quality) {
  var U = PF.Util;
  var self = this;
  var pal = zone.palette;

  /* ---------- Cúpula ---------- */
  var skyUniforms = {
    top: { value: new THREE.Color(pal.skyTop) },
    horizon: { value: new THREE.Color(pal.skyHorizon) },
    ground: { value: new THREE.Color(pal.fog) },
    sunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    sunColor: { value: new THREE.Color(pal.sun) },
    stars: { value: 0 },
    time: { value: 0 }
  };
  var skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: [
      'varying vec3 vDir;',
      'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; uniform float time;',
      'varying vec3 vDir;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }',
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  float y = d.y;',
      '  vec3 col = mix(horizon, top, pow(clamp(y,0.0,1.0), 0.55));',
      '  col = mix(col, ground, smoothstep(0.02, -0.12, y));',
      '  float s = max(dot(d, normalize(sunDir)), 0.0);',
      '  col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 900.0) * 2.2);',
      // Bandas de nubes planas (estilo pintado): muy poco ruido
      '  vec2 cp = d.xz / max(y + 0.15, 0.05);',
      '  float c = smoothstep(0.55, 0.75, sin(cp.x * 0.9 + time * 0.01) * 0.5 + sin(cp.y * 1.7 + cp.x * 0.3) * 0.5);',
      '  col = mix(col, mix(horizon, vec3(1.0,0.96,0.9), 0.5), c * 0.35 * smoothstep(0.03, 0.25, y));',
      // Estrellas por la noche
      '  if (stars > 0.0 && y > 0.0) {',
      '    vec2 g = floor(d.xz / (y + 0.4) * 180.0);',
      '    float st = step(0.996, h(g)) * stars * smoothstep(0.0, 0.3, y);',
      '    col += vec3(st);',
      '  }',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 12), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  this.sky = sky;

  /* ---------- Sol / luna (discos) ---------- */
  var sunMesh = new THREE.Mesh(new THREE.CircleGeometry(38, 20), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false, transparent: true }));
  scene.add(sunMesh);
  var moonMesh = new THREE.Mesh(new THREE.CircleGeometry(22, 20), new THREE.MeshBasicMaterial({ color: 0xe8e4d6, fog: false, transparent: true }));
  scene.add(moonMesh);

  /* ---------- Montañas en capas ---------- */
  var layers = [];
  function ridge(radius, baseH, amp, freq, seed, color, segs, arcFrom, arcTo) {
    var pos = [], idx = [];
    var rnd = U.rng(seed);
    var off = rnd() * 100;
    for (var i = 0; i <= segs; i++) {
      var a = arcFrom + (arcTo - arcFrom) * (i / segs);
      // Perfil: crestas suaves (seno) + picos irregulares (ruido), pocas frecuencias = look plano
      var n = U.fbm(i * freq + off, seed, 3);
      var hgt = baseH + amp * (0.55 + n) + amp * 0.4 * Math.max(0, Math.sin(i * freq * 0.37 + off));
      var x = Math.sin(a) * radius, z = -Math.cos(a) * radius;
      pos.push(x, -40, z, x, Math.max(hgt, 2), z);
      if (i < segs) { var k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), fog: false, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -5;
    scene.add(mesh);
    layers.push({ mesh: mesh, base: new THREE.Color(color), haze: 0 });
    return mesh;
  }
  var segs = quality.low ? 120 : 220;
  // De lejos a cerca (se dibujan en orden, con depthTest normal)
  ridge(1150, 70, 120, 0.09, 11, pal.mountainFarthest, segs, -Math.PI, Math.PI);
  ridge(900, 30, 95, 0.14, 23, pal.mountainFar, segs, -Math.PI, Math.PI);
  ridge(650, 6, 60, 0.22, 37, pal.mountainNear, segs, -Math.PI, Math.PI);
  layers[0].haze = 0.55; layers[1].haze = 0.35; layers[2].haze = 0.15;

  /* ---------- Volcán con fumarola ---------- */
  var volcano = new THREE.Group();
  var cone = new THREE.Mesh(new THREE.CylinderGeometry(28, 190, 230, 14, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.mountainFar).offsetHSL(0, 0, -0.05), fog: false }));
  cone.position.y = 75;
  volcano.add(cone);
  var crater = new THREE.Mesh(new THREE.CircleGeometry(28, 14), new THREE.MeshBasicMaterial({ color: 0x5a3020, fog: false }));
  crater.rotation.x = -Math.PI / 2; crater.position.y = 190; volcano.add(crater);
  volcano.position.set(-520, 0, -780);
  scene.add(volcano);
  layers.push({ mesh: cone, base: cone.material.color.clone(), haze: 0.3 });

  // Humo: sprites planos (círculos) que suben y se expanden — barato y legible
  var smokeMat = new THREE.MeshBasicMaterial({ color: 0x9a8a7a, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  var smoke = [];
  var smokeN = quality.low ? 8 : 14;
  for (var i = 0; i < smokeN; i++) {
    var p = new THREE.Mesh(new THREE.CircleGeometry(1, 10), smokeMat.clone());
    p.userData.t = i / smokeN;
    scene.add(p);
    smoke.push(p);
  }
  var glow = new THREE.PointLight(0xff6a2a, 0, 400);
  glow.position.set(-520, 200, -780);

  /* ---------- Luces ---------- */
  var hemi = new THREE.HemisphereLight(0xffe2b0, 0x6b5a3a, 0.75);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xffe0b0, 1.0);
  scene.add(sun);
  scene.add(sun.target);
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);

  /* ---------- Paletas clave del día (hora -> colores) ----------
     Tonos cálidos (ocres, ámbar, rosados) predominan incluso de día:
     sugieren una atmósfera densa, húmeda y tropical (el Viseano escocés
     estaba cerca del ecuador). */
  var KEYS = [
    { h: 0,    top: '#0d1626', hor: '#2a2f45', fog: '#262b3a', sun: '#000000', sunI: 0.0, hemi: 0.28, hemiSky: '#6a7aa8', hemiGround: '#20201c', star: 1 },
    { h: 4.8,  top: '#1b2238', hor: '#5a4a5a', fog: '#4a4250', sun: '#ff8a50', sunI: 0.05, hemi: 0.32, hemiSky: '#8a88a8', hemiGround: '#2a2620', star: 0.6 },
    { h: 6.0,  top: '#5b7a9a', hor: '#f4a46a', fog: '#d9946a', sun: '#ffb070', sunI: 0.7, hemi: 0.55, hemiSky: '#ffc89a', hemiGround: '#5a4630', star: 0 },
    { h: 8.0,  top: '#6f9fb8', hor: '#f2c894', fog: '#d9b98a', sun: '#ffe0b0', sunI: 1.0, hemi: 0.75, hemiSky: '#ffe2b0', hemiGround: '#6b5a3a', star: 0 },
    { h: 13.0, top: '#5f98bb', hor: '#efd3a3', fog: '#dcc39a', sun: '#fff0d0', sunI: 1.15, hemi: 0.85, hemiSky: '#fff0d0', hemiGround: '#6f5e3e', star: 0 },
    { h: 17.5, top: '#6b8fae', hor: '#f0b47a', fog: '#d8a676', sun: '#ffc888', sunI: 0.95, hemi: 0.7, hemiSky: '#ffd0a0', hemiGround: '#6a5232', star: 0 },
    { h: 19.2, top: '#4a4e78', hor: '#f07a4a', fog: '#b86a52', sun: '#ff7a3a', sunI: 0.55, hemi: 0.5, hemiSky: '#ff9a7a', hemiGround: '#4a3024', star: 0.1 },
    { h: 20.6, top: '#1a1e38', hor: '#5a3a4a', fog: '#3a2e3a', sun: '#ff5a2a', sunI: 0.06, hemi: 0.32, hemiSky: '#7a6a9a', hemiGround: '#24201c', star: 0.7 },
    { h: 24,   top: '#0d1626', hor: '#2a2f45', fog: '#262b3a', sun: '#000000', sunI: 0.0, hemi: 0.28, hemiSky: '#6a7aa8', hemiGround: '#20201c', star: 1 }
  ];
  var tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function lerpKey(field, a, b, t, out) { tmpA.set(a[field]); tmpB.set(b[field]); return out.copy(tmpA).lerp(tmpB, t); }

  this.fogColor = new THREE.Color();
  this.sunDir = new THREE.Vector3();
  this.night = 0;
  this.light = 1;

  /* Actualiza todo según la hora (0..24) y la posición de cámara */
  this.update = function (hour, camPos, dt, time) {
    var a = KEYS[0], b = KEYS[1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (hour >= KEYS[i].h && hour < KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    var t = (hour - a.h) / (b.h - a.h);
    lerpKey('top', a, b, t, skyUniforms.top.value);
    lerpKey('hor', a, b, t, skyUniforms.horizon.value);
    lerpKey('fog', a, b, t, self.fogColor);
    skyUniforms.ground.value.copy(self.fogColor);
    scene.fog.color.copy(self.fogColor);
    lerpKey('sun', a, b, t, sun.color);
    sun.intensity = U.lerp(a.sunI, b.sunI, t);
    hemi.intensity = U.lerp(a.hemi, b.hemi, t);
    lerpKey('hemiSky', a, b, t, hemi.color);
    lerpKey('hemiGround', a, b, t, hemi.groundColor);
    skyUniforms.stars.value = U.lerp(a.star, b.star, t);
    skyUniforms.time.value = time;
    skyUniforms.sunColor.value.copy(sun.color);

    // Trayectoria solar: sale por la izquierda (este), cruza al sur del lago
    var ang = ((hour - 6) / 12) * Math.PI; // 0 al amanecer, PI al ocaso
    var sd = self.sunDir.set(-Math.cos(ang) * 0.8, Math.sin(ang) * 0.75, -0.6).normalize();
    skyUniforms.sunDir.value.copy(sd);
    sun.position.copy(camPos).addScaledVector(sd, 200);
    sun.target.position.copy(camPos);
    sunMesh.position.copy(camPos).addScaledVector(sd, 1300);
    sunMesh.lookAt(camPos);
    sunMesh.material.opacity = U.smooth(-0.08, 0.02, sd.y);
    moonMesh.position.copy(camPos).addScaledVector(new THREE.Vector3(-sd.x, -sd.y + 0.2, -0.7).normalize(), 1300);
    moonMesh.lookAt(camPos);
    moonMesh.material.opacity = U.smooth(0.0, -0.15, sd.y);

    self.night = U.smooth(0.08, -0.12, sd.y);
    self.light = 0.25 + 0.75 * (1 - self.night);

    // Montañas: color base -> niebla según "haze" y oscurecidas por la noche
    for (var l = 0; l < layers.length; l++) {
      var L = layers[l];
      L.mesh.material.color.copy(L.base).lerp(self.fogColor, L.haze + self.night * 0.3)
        .multiplyScalar(0.55 + 0.45 * self.light);
    }
    sky.position.copy(camPos);

    // Humo del volcán
    for (var s = 0; s < smoke.length; s++) {
      var p = smoke[s];
      p.userData.t = (p.userData.t + dt * 0.012) % 1;
      var k = p.userData.t;
      p.position.set(-520 + k * 160 + Math.sin(k * 6 + s) * 10, 195 + k * 260, -780 + k * 40);
      var sc = 20 + k * 90;
      p.scale.set(sc, sc, sc);
      p.lookAt(camPos);
      p.material.opacity = (1 - k) * 0.45;
      p.material.color.copy(self.fogColor).lerp(tmpA.set(0x6a5a50), 0.5);
    }
    glow.intensity = self.night * 2;
    crater.material.color.setRGB(0.35 + self.night * 0.6, 0.18 + self.night * 0.12, 0.1);
  };
};
