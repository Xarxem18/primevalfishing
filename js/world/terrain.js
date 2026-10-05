/* =====================================================================
   PRIMEVAL FISHING — TERRENO Y AGUA
   ---------------------------------------------------------------------
   Terreno: malla regular con colores por vértice (sin texturas). Los
   colores se eligen por altura/pendiente/humedad con bandas suaves:
   lodo -> arena -> musgo -> pasto de licopodios -> roca. Ruido muy bajo
   para conseguir el aspecto "plano pintado" pedido.

   Agua: shader propio, barato (sin reflejos en tiempo real):
     - color por profundidad (atributo 'depth' horneado desde heightAt)
     - ondas analíticas en el fragment -> normal -> brillo solar
     - fresnel hacia el color del cielo/niebla
     - espuma suave en la orilla
     - ondas de impacto (ripples) inyectadas desde el juego
   ===================================================================== */
window.PF = window.PF || {};

PF.Terrain = function (scene, zone, quality) {
  var U = PF.Util;
  var pal = zone.palette;
  var self = this;

  var X0 = -330, X1 = 330, Z0 = -330, Z1 = 150;
  var RX = quality.low ? 130 : 200, RZ = quality.low ? 100 : 150;

  var geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, RX, RZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  var pos = geo.attributes.position;
  var colors = new Float32Array(pos.count * 3);
  var C = {
    mud: new THREE.Color(pal.mud), sand: new THREE.Color(pal.sand), moss: new THREE.Color(pal.moss),
    grass: new THREE.Color(pal.grass), rock: new THREE.Color(pal.rock), deep: new THREE.Color(pal.waterDeep).multiplyScalar(0.6)
  };
  var c = new THREE.Color(), t = new THREE.Color();
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), z = pos.getZ(i);
    var h = zone.heightAt(x, z);
    pos.setY(i, h);
    var e = 1.2;
    var slope = Math.abs(zone.heightAt(x + e, z) - zone.heightAt(x - e, z)) + Math.abs(zone.heightAt(x, z + e) - zone.heightAt(x, z - e));
    var n = U.noise(x * 0.08, z * 0.08) * 0.5 + U.noise(x * 0.31, z * 0.31) * 0.15;
    if (h < -1.5) c.copy(C.mud).lerp(C.deep, U.smooth(-1.5, -6, h));
    else if (h < 0.35) c.copy(C.mud).lerp(C.sand, U.smooth(-1.2, 0.3, h));
    else if (h < 1.4) c.copy(C.sand).lerp(C.moss, U.smooth(0.6, 1.4, h + n * 0.6));
    else c.copy(C.moss).lerp(C.grass, U.smooth(-0.2, 0.4, n));
    if (slope > 1.1) c.lerp(C.rock, U.smooth(1.1, 2.2, slope));
    if (h > 14) c.lerp(t.copy(C.rock).offsetHSL(0, -0.05, 0.08), U.smooth(14, 30, h));
    // Variación muy suave de tono (no ruido de alta frecuencia)
    c.offsetHSL(n * 0.015, n * 0.04, n * 0.035);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  scene.add(mesh);
  this.mesh = mesh;

  /* ---------------- AGUA ---------------- */
  var WX0 = -330, WX1 = 330, WZ0 = -300, WZ1 = 40;
  var wgeo = new THREE.PlaneGeometry(WX1 - WX0, WZ1 - WZ0, quality.low ? 70 : 110, quality.low ? 40 : 60);
  wgeo.rotateX(-Math.PI / 2);
  wgeo.translate((WX0 + WX1) / 2, 0, (WZ0 + WZ1) / 2);
  var wp = wgeo.attributes.position;
  var depthAttr = new Float32Array(wp.count);
  for (var j = 0; j < wp.count; j++) depthAttr[j] = -zone.heightAt(wp.getX(j), wp.getZ(j));
  wgeo.setAttribute('depth', new THREE.BufferAttribute(depthAttr, 1));

  var MAX_RIPPLES = 6;
  var ripples = [];
  for (var r = 0; r < MAX_RIPPLES; r++) ripples.push(new THREE.Vector4(0, 0, -100, 0));

  this.waterUniforms = {
    time: { value: 0 },
    shallow: { value: new THREE.Color(pal.waterShallow) },
    deep: { value: new THREE.Color(pal.waterDeep) },
    foam: { value: new THREE.Color(pal.waterFoam) },
    skyCol: { value: new THREE.Color(pal.skyHorizon) },
    sunDir: { value: new THREE.Vector3(0, 0.5, -1) },
    sunCol: { value: new THREE.Color(pal.sun) },
    light: { value: 1 },
    ripples: { value: ripples },
    fogColor: { value: new THREE.Color(pal.fog) },
    fogNear: { value: pal.fogNear },
    fogFar: { value: pal.fogFar }
  };
  var wmat = new THREE.ShaderMaterial({
    uniforms: this.waterUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: [
      'attribute float depth;',
      'uniform float time;',
      'varying float vDepth; varying vec3 vWorld; varying float vFogDepth;',
      'void main(){',
      '  vDepth = depth;',
      '  vec3 p = position;',
      '  p.y += (sin(p.x*0.15 + time*1.1) + sin(p.z*0.21 + time*0.8)) * 0.04 * clamp(depth, 0.0, 1.0);',
      '  vec4 w = modelMatrix * vec4(p,1.0); vWorld = w.xyz;',
      '  vec4 mv = viewMatrix * w; vFogDepth = -mv.z;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float time; uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam; uniform vec3 skyCol;',
      'uniform vec3 sunDir; uniform vec3 sunCol; uniform float light; uniform vec4 ripples[' + MAX_RIPPLES + '];',
      'uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
      'varying float vDepth; varying vec3 vWorld; varying float vFogDepth;',
      'void main(){',
      '  vec2 p = vWorld.xz;',
      // Normal analítica: suma de 4 ondas direccionales (sin texturas)
      '  float t = time;',
      '  vec2 g = vec2(0.0);',
      '  g += vec2(0.8,0.6)  * cos(dot(p, vec2(0.8,0.6))*0.9 + t*1.4) * 0.30;',
      '  g += vec2(-0.5,0.9) * cos(dot(p, vec2(-0.5,0.9))*1.7 + t*1.9) * 0.18;',
      '  g += vec2(0.2,-1.0) * cos(dot(p, vec2(0.2,-1.0))*3.1 + t*2.6) * 0.10;',
      '  g += vec2(1.0,0.1)  * cos(dot(p, vec2(1.0,0.1))*5.3 + t*3.3) * 0.05;',
      // Ondas de impacto
      '  float ring = 0.0;',
      '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++) {',
      '    vec4 r = ripples[i];',
      '    float age = t - r.z;',
      '    if (age > 0.0 && age < 3.0) {',
      '      vec2 d = p - r.xy; float dist = length(d);',
      '      float wave = sin(dist*3.0 - age*7.0) * exp(-abs(dist - age*2.3)*1.2) * (1.0 - age/3.0) * r.w;',
      '      g += normalize(d + 0.0001) * wave * 0.8;',
      '      ring += max(wave, 0.0);',
      '    }',
      '  }',
      '  vec3 n = normalize(vec3(-g.x*0.35, 1.0, -g.y*0.35));',
      '  vec3 view = normalize(cameraPosition - vWorld);',
      '  float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);',
      '  float d = clamp(vDepth / 6.0, 0.0, 1.0);',
      '  vec3 col = mix(shallow, deep, smoothstep(0.0, 1.0, d));',
      '  col = mix(col, skyCol, fres * 0.65);',
      '  vec3 h = normalize(normalize(sunDir) + view);',
      '  float spec = pow(max(dot(n, h), 0.0), 140.0);',
      '  col += sunCol * spec * 1.4 * light;',
      // Espuma de orilla, con bandas planas (look pintado)
      '  float shore = 1.0 - smoothstep(0.0, 0.45, vDepth);',
      '  float band = step(0.5, fract(vDepth*3.0 - t*0.25)) * (1.0 - smoothstep(0.0, 0.7, vDepth));',
      '  col = mix(col, foam, clamp(shore*0.7 + band*0.25 + ring*0.4, 0.0, 1.0));',
      '  col *= 0.35 + 0.65*light;',
      '  float alpha = clamp(0.55 + d*0.4 + fres*0.2, 0.0, 0.96) * smoothstep(-0.25, 0.05, vDepth);',
      '  float fogF = smoothstep(fogNear, fogFar, vFogDepth);',
      '  col = mix(col, fogColor, fogF);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });
  var water = new THREE.Mesh(wgeo, wmat);
  water.renderOrder = 2;
  scene.add(water);
  this.water = water;

  var rippleIdx = 0;
  this.addRipple = function (x, z, strength) {
    var v = ripples[rippleIdx % MAX_RIPPLES];
    v.set(x, z, self.waterUniforms.time.value, strength == null ? 1 : strength);
    rippleIdx++;
  };

  this.update = function (time, sky) {
    var u = self.waterUniforms;
    u.time.value = time;
    u.sunDir.value.copy(sky.sunDir);
    u.sunCol.value.copy(sky.sky.material.uniforms.sunColor.value);
    u.skyCol.value.copy(sky.sky.material.uniforms.horizon.value).lerp(sky.fogColor, 0.3);
    u.fogColor.value.copy(sky.fogColor);
    u.light.value = sky.light;
  };
};
