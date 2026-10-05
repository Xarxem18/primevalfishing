/* =====================================================================
   PRIMEVAL FISHING — HELPERS DE GEOMETRÍA
   ---------------------------------------------------------------------
   Construimos plantas, rocas y peces combinando primitivas y fusionándolas
   en una única BufferGeometry con colores por vértice. Ventaja: una sola
   draw call por tipo de objeto (InstancedMesh), crucial en móviles.
   No dependemos de BufferGeometryUtils para mantener three.js como único
   archivo externo.
   ===================================================================== */
window.PF = window.PF || {};

PF.Geo = (function () {
  /* Pinta todos los vértices de una geometría con un color (o función) */
  function paint(geo, color) {
    var g = geo.index ? geo.toNonIndexed() : geo;
    var pos = g.attributes.position, n = pos.count;
    var col = new Float32Array(n * 3), c = new THREE.Color();
    for (var i = 0; i < n; i++) {
      if (typeof color === 'function') color(pos.getX(i), pos.getY(i), pos.getZ(i), c);
      else c.set(color);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  /* Fusiona geometrías no indexadas con position/normal/color */
  function merge(list) {
    var total = 0;
    list.forEach(function (g) { total += g.attributes.position.count; });
    var P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
    var o = 0;
    list.forEach(function (g) {
      if (!g.attributes.normal) g.computeVertexNormals();
      P.set(g.attributes.position.array, o);
      N.set(g.attributes.normal.array, o);
      C.set(g.attributes.color.array, o);
      o += g.attributes.position.count * 3;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.computeBoundingSphere();
    return out;
  }

  function xf(geo, px, py, pz, rx, ry, rz, s) {
    var m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      typeof s === 'number' ? new THREE.Vector3(s, s, s) : (s || new THREE.Vector3(1, 1, 1)));
    geo.applyMatrix4(m);
    return geo;
  }

  /* Hoja/fronda: tira de triángulos curvada, ancho máximo en el centro */
  function frond(len, width, curve, segs) {
    var verts = [];
    segs = segs || 5;
    for (var i = 0; i < segs; i++) {
      var t0 = i / segs, t1 = (i + 1) / segs;
      var w0 = Math.sin(t0 * Math.PI) * width + 0.02, w1 = Math.sin(t1 * Math.PI) * width + 0.02;
      var y0 = -curve * t0 * t0 * len, y1 = -curve * t1 * t1 * len;
      var z0 = t0 * len, z1 = t1 * len;
      verts.push(-w0, y0, z0, w0, y0, z0, w1, y1, z1);
      verts.push(-w0, y0, z0, w1, y1, z1, -w1, y1, z1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    g.computeVertexNormals();
    return g;
  }

  return { paint: paint, merge: merge, xf: xf, frond: frond };
})();
