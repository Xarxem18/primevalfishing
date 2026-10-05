/* =====================================================================
   PRIMEVAL FISHING — ZONAS
   ---------------------------------------------------------------------
   Una zona = una "cápsula paleoecológica" (ver doc de zonas, sección 1-2).
   Contiene:
     - metadatos científicos (localidad, edad, ambiente)
     - paleta visual (cielo, niebla, agua, terreno)  -> world/*.js
     - función de relieve heightAt(x,z)               -> terrain/water
     - función de microhábitat habitatAt(x,z,depth)   -> fishing.js
     - pool de especies con pesos por microhábitat
     - puestos de pesca (spots) y vegetación
   Para crear la zona 2: copiar el bloque WARDIE, cambiar datos, relieve y
   pool. El motor no tiene nada específico de Wardie fuera de este archivo.
   ===================================================================== */
window.PF = window.PF || {};

(function () {
  var U = PF.Util;

  /* ---------- Relieve de Wardie ----------
     Convención: y = 0 es el nivel del agua. Lado +Z = orilla del jugador.
     El lago-laguna se extiende hacia -Z hasta la orilla lejana (~ -230). */
  function shoreZ(x) {
    return 7 * Math.sin(x * 0.031) + 4 * Math.sin(x * 0.073 + 1.3) + 3 * Math.sin(x * 0.012 - 0.5);
  }
  function farShoreZ(x) {
    return -235 + 22 * Math.sin(x * 0.017 + 0.7) + 9 * Math.sin(x * 0.05);
  }
  function channelZ(x) {
    return -58 + 16 * Math.sin(x * 0.021 + 0.4);
  }
  function streamX(z) {
    return -68 + 7 * Math.sin(z * 0.06) + 3 * Math.sin(z * 0.15);
  }

  function heightAt(x, z) {
    var n = U.fbm(x * 0.018, z * 0.018, 3);
    var d = z - shoreZ(x);
    var h;
    if (d >= 0) {
      // Orilla del jugador: playa suave -> terraza musgosa -> colinas
      h = Math.min(d * 0.13, 1.6) + Math.max(0, d - 18) * 0.09 + n * 2.2 * U.smooth(5, 40, d);
      h += Math.max(0, d - 70) * 0.18;
    } else {
      // Lecho del lago: plataforma somera, talud y canal profundo
      var dd = -d;
      var depth = Math.min(dd * 0.085, 2.4) + U.smooth(20, 80, dd) * 1.6;
      var cz = channelZ(x);
      depth += 4.2 * Math.exp(-Math.pow((z - cz) / 15, 2));
      depth += n * 0.7;
      // Subida hacia la orilla lejana
      var fd = z - farShoreZ(x); // negativo pasado la orilla lejana
      if (fd < 30) depth *= U.smooth(-6, 30, fd);
      h = -depth;
      if (fd < -6) h = (-fd - 6) * 0.25 + n * 4;
    }
    // Arroyo afluente que baja por la izquierda
    if (z > shoreZ(x) - 14) {
      var sx = streamX(z);
      var w = 4.5 + Math.max(0, -z) * 0.25;
      var k = Math.exp(-Math.pow((x - sx) / w, 2));
      var target = Math.min(h, -0.6 + Math.max(0, z) * 0.012);
      h = U.lerp(h, target, k);
    }
    // Laterales: el mapa se cierra con colinas (no se ve el borde)
    var edge = U.smooth(230, 300, Math.abs(x));
    h = U.lerp(h, Math.max(h, 6 + n * 8), edge);
    return h;
  }

  var WEEDS = [
    { x: -30, z: -14, r: 11 }, { x: 18, z: -20, r: 9 }, { x: 46, z: -12, r: 10 },
    { x: -84, z: -22, r: 12 }, { x: 88, z: -28, r: 13 }, { x: -8, z: -36, r: 7 },
    { x: 130, z: -18, r: 12 }, { x: -130, z: -16, r: 11 }
  ];

  function inWeeds(x, z) {
    for (var i = 0; i < WEEDS.length; i++) {
      var w = WEEDS[i];
      var dx = x - w.x, dz = z - w.z;
      if (dx * dx + dz * dz < w.r * w.r) return true;
    }
    return false;
  }

  /* Microhábitats (doc de zonas, sección 9) */
  function habitatAt(x, z, depth) {
    var mouth = Math.hypot(x - streamX(0), z - (shoreZ(-68) - 6));
    if (mouth < 18) return 'inflow';
    if (inWeeds(x, z)) return 'weeds';
    if (depth > 4.6) return 'channel';
    if (depth < 1.6) return 'shallows';
    return 'open';
  }

  PF.ZONES = [
    {
      id: 'wardie',
      num: '01',
      name: 'Wardie',
      title: 'El Gran Río del Carbonífero Escocés',
      location: 'Wardie / Edimburgo, Escocia',
      age: 'Carbonífero inferior, Viseano (~339–336 Ma)',
      env: 'Laguna/lago y llanura costera con influencia de agua dulce; lutitas ricas en materia orgánica.',
      fishing: 'Orilla, agua poco profunda',
      unlocked: true,
      unlockLevel: 1,
      ticket: 0,

      // ---- Paleta (justificada en docs/DESIGN_DECISIONS.md §3) ----
      palette: {
        skyTop: '#6f9fb8', skyHorizon: '#f2c894', sun: '#ffd9a0',
        fog: '#d9b98a', fogNear: 60, fogFar: 520,
        waterShallow: '#8a9a5a', waterDeep: '#2f5650', waterFoam: '#efe2bf',
        sand: '#c9ab78', mud: '#7d6440', moss: '#6d7a38', grass: '#8a8a3e', rock: '#7a6a58',
        mountainNear: '#8a6f5a', mountainFar: '#b4927a', mountainFarthest: '#d1ad8c'
      },

      heightAt: heightAt,
      habitatAt: habitatAt,
      shoreZ: shoreZ,
      streamX: streamX,
      channelZ: channelZ,
      weeds: WEEDS,
      bounds: { minX: -220, maxX: 220, minZ: -3, maxZ: 70 },

      habitats: {
        shallows: { name: 'Bajíos', hint: 'Agua cálida y somera. Bancos de peces pequeños.' },
        weeds:    { name: 'Herbazal', hint: 'Vegetación sumergida. Emboscadas.' },
        open:     { name: 'Laguna abierta', hint: 'Profundidad media, peces errantes.' },
        channel:  { name: 'Canal profundo', hint: 'El agua oscura donde patrullan los grandes.' },
        inflow:   { name: 'Desembocadura', hint: 'Agua oxigenada y alimento arrastrado.' }
      },

      /* POOL — pesos por microhábitat (multiplican species.rarity).
         Regla especial de la zona: los pequeños dominan; Rhizodus es raro. */
      pool: {
        rhadinichthys:  { shallows: 1.6, weeds: 1.0, open: 0.8, channel: 0.3, inflow: 1.2 },
        acanthodes:     { shallows: 1.0, weeds: 0.6, open: 1.3, channel: 0.6, inflow: 0.9 },
        elonichthys:    { shallows: 1.0, weeds: 1.1, open: 1.0, channel: 0.6, inflow: 1.5 },
        gonatodus:      { shallows: 0.8, weeds: 1.8, open: 0.5, channel: 0.2, inflow: 0.6 },
        wardichthys:    { shallows: 0.7, weeds: 1.7, open: 0.6, channel: 0.2, inflow: 0.4 },
        eurynotus:      { shallows: 0.6, weeds: 0.8, open: 1.0, channel: 1.2, inflow: 0.7 },
        cosmoptychius:  { shallows: 0.5, weeds: 1.0, open: 1.2, channel: 1.0, inflow: 1.3 },
        onychoselache:  { shallows: 0.9, weeds: 0.7, open: 0.8, channel: 1.1, inflow: 0.6 },
        diplodoselache: { shallows: 0.3, weeds: 1.2, open: 0.8, channel: 1.5, inflow: 0.8 },
        sphenacanthus:  { shallows: 0.1, weeds: 0.4, open: 0.9, channel: 2.0, inflow: 0.6 },
        lungfish:       { shallows: 0.8, weeds: 1.4, open: 0.6, channel: 0.8, inflow: 0.3 },
        nematoptychius: { shallows: 0.4, weeds: 2.2, open: 0.6, channel: 0.5, inflow: 1.4 },
        megalichthys:   { shallows: 0.1, weeds: 0.8, open: 0.8, channel: 2.2, inflow: 1.0 },
        rhizodus:       { shallows: 0.0, weeds: 1.6, open: 0.3, channel: 2.4, inflow: 0.6 }
      },

      // Encuentros ambientales (doc de zonas, secciones 3 y 16)
      encounters: {
        apexSpecies: 'rhizodus',
        apexAmbientEvery: [70, 160],     // segundos entre apariciones de la silueta adulta
        apexAttackChance: 0.05,          // por combate de pez pequeño/mediano en canal/herbazal
        environmentalFauna: ['Crassigyrinus (tetrápodo acuático, silueta)']
      },

      spots: [
        { id: 'beach', name: 'Playa de las Calamites', x: 2, z: 6, yaw: 0, desc: 'Bajíos amplios y un herbazal a tiro de lance.' },
        { id: 'mouth', name: 'Boca del Arroyo', x: -52, z: 5, yaw: 0.45, desc: 'El afluente trae alimento. Buen sitio al amanecer.' },
        { id: 'point', name: 'Punta del Lepidodendro', x: 62, z: 4, yaw: -0.3, desc: 'El canal profundo pasa cerca. Territorio de grandes.' }
      ],

      vegetation: {
        lepidodendron: 70, calamites: 160, fern: 420, reed: 520, rock: 120, log: 18, lily: 180
      }
    },

    // ---- Zonas futuras (bloqueadas) — solo metadatos para el selector ----
    { id: 'beargulch', num: '02', name: 'Bear Gulch', title: 'La Bahía de los Tiburones', location: 'Montana, EE.UU.', age: 'Mississippiano tardío (~318 Ma)', unlocked: false, unlockLevel: 6 },
    { id: 'kalna', num: '03', name: 'Kalná', title: 'Xenacanthus en el Lago Pérmico', location: 'República Checa', age: 'Pérmico inferior', unlocked: false, unlockLevel: 9 },
    { id: 'cleveland', num: '04', name: 'Cleveland Shale', title: 'El Mar del Dunkleosteus', location: 'Ohio, EE.UU.', age: 'Devónico tardío', unlocked: false, unlockLevel: 12 },
    { id: 'sodasprings', num: '05', name: 'Soda Springs', title: 'La Espiral de Helicoprion', location: 'Idaho, EE.UU.', age: 'Pérmico', unlocked: false, unlockLevel: 15 },
    { id: 'holzmaden', num: '06', name: 'Holzmaden', title: 'Los Cazadores del Toarciano', location: 'Alemania', age: 'Jurásico inferior', unlocked: false, unlockLevel: 18 }
  ];

  PF.getZone = function (id) {
    for (var i = 0; i < PF.ZONES.length; i++) if (PF.ZONES[i].id === id) return PF.ZONES[i];
    return null;
  };
})();
