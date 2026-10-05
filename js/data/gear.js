/* =====================================================================
   PRIMEVAL FISHING — POOL BÁSICO DE EQUIPO
   ---------------------------------------------------------------------
   Subconjunto inicial del documento "pool de objetos, marcas y equipo".
   Diseño modular: cada pieza modifica una variable real de la simulación
   (ver docs/DESIGN_DECISIONS.md, sección "Modelo de combate").

   Unidades: kg para resistencias, m para distancias, ámbar (◈) para precios.
   Para añadir objetos: copiar una entrada, cambiar id y valores. Las
   familias (ej. "K-Lancer 270/300") se expresan con ids distintos.
   ===================================================================== */
window.PF = window.PF || {};

PF.BRANDS = {
  paleon:    { name: 'Paleon',    motto: 'Es barato, pero cumple.',          color: '#b9a37a' },
  strata:    { name: 'Strata',    motto: 'Relación calidad/precio.',         color: '#7fa36b' },
  xenacanth: { name: 'Xenacanth', motto: 'Ligereza y sensibilidad.',         color: '#6fb3b8' },
  mawsonia:  { name: 'Mawsonia',  motto: 'Durabilidad y fiabilidad.',        color: '#5f7fae' },
  rhizo:     { name: 'Rhizo',     motto: 'Potencia.',                        color: '#c0562e' },
  kaykay:    { name: 'Kaykay',    motto: 'Designed Around the Fish.',        color: '#e3b04b' },
  aegis:     { name: 'Aegis',     motto: 'Protección y control.',            color: '#9a8fb5' },
  helicoprion:{ name: 'Helicoprion', motto: 'Innovación.',                   color: '#d07ab0' },
  gondwana:  { name: 'Gondwana',  motto: 'Pesca de expedición.',             color: '#8c7a3d' },
  lafken:    { name: 'Lafken',    motto: 'Dominio marino.',                  color: '#3d8fb0' }
};

/* CAÑAS
   power     carga máxima en kg antes de partirse (con tensión sostenida)
   sens      sensibilidad 0..1: amplía la ventana de clavado y avisa picadas
   cast      multiplicador de distancia de lanzado
   flex      amortiguación: reduce los picos de tensión por sacudidas
   tech      técnicas compatibles */
PF.GEAR_RODS = [
  { id: 'rod_paleon_spin', brand: 'paleon', name: 'Paleon Wanderer 210', type: 'Spinning', cls: 'L',  power: 6,  sens: 0.45, cast: 0.85, flex: 0.55, tech: ['spin', 'float'], price: 0, level: 1 },
  { id: 'rod_xena_ul',     brand: 'xenacanth', name: 'Xenacanth Filament UL 195', type: 'Spinning', cls: 'UL', power: 4, sens: 0.85, cast: 0.8, flex: 0.7, tech: ['spin', 'float'], price: 380, level: 1 },
  { id: 'rod_strata_m',    brand: 'strata', name: 'Strata Ridge M 240', type: 'Spinning', cls: 'M', power: 12, sens: 0.6, cast: 1.0, flex: 0.55, tech: ['spin', 'float'], price: 720, level: 2 },
  { id: 'rod_maws_float',  brand: 'mawsonia', name: 'Mawsonia Lagoon Float 390', type: 'Float', cls: 'ML', power: 9, sens: 0.75, cast: 1.15, flex: 0.75, tech: ['float'], price: 900, level: 2 },
  { id: 'rod_kaykay_mh',   brand: 'kaykay', name: 'Kaykay K-Lancer MH 270', type: 'Spinning', cls: 'MH', power: 24, sens: 0.92, cast: 1.15, flex: 0.65, tech: ['spin', 'float'], price: 3400, level: 4 },
  { id: 'rod_rhizo_h',     brand: 'rhizo', name: 'Rhizo Fang H 240', type: 'Casting', cls: 'H', power: 48, sens: 0.45, cast: 0.95, flex: 0.45, tech: ['spin', 'float'], price: 2600, level: 4 }
];

/* CARRETES
   drag      drag máximo (kg). El jugador ajusta el % en el combate.
   dragPrec  precisión del drag (0..1): suaviza los tirones al soltar línea
   speed     velocidad de recogida (m/s a manivela completa)
   cap       capacidad de línea (m) — si el pez la vacía, se escapa */
PF.GEAR_REELS = [
  { id: 'reel_paleon_1000', brand: 'paleon', name: 'Paleon Spin 1000', drag: 4, dragPrec: 0.5, speed: 1.6, cap: 110, price: 0, level: 1 },
  { id: 'reel_xena_1500',   brand: 'xenacanth', name: 'Xenacanth Whisper 1500', drag: 3.5, dragPrec: 0.85, speed: 1.9, cap: 120, price: 340, level: 1 },
  { id: 'reel_strata_3000', brand: 'strata', name: 'Strata Grind 3000', drag: 9, dragPrec: 0.65, speed: 1.9, cap: 170, price: 650, level: 2 },
  { id: 'reel_maws_4000',   brand: 'mawsonia', name: 'Mawsonia Bedrock 4000', drag: 12, dragPrec: 0.7, speed: 1.75, cap: 210, price: 1100, level: 3 },
  { id: 'reel_kaykay_5000', brand: 'kaykay', name: 'Kaykay Meridian 5000', drag: 18, dragPrec: 0.97, speed: 2.2, cap: 230, price: 3900, level: 4 },
  { id: 'reel_rhizo_bg',    brand: 'rhizo', name: 'Rhizo Maw Big Game 8000', drag: 34, dragPrec: 0.6, speed: 1.6, cap: 320, price: 3100, level: 4 }
];

/* LÍNEAS
   test      resistencia nominal (kg)
   vis       visibilidad (0..1): reduce la confianza de peces recelosos
   stretch   elasticidad: amortigua picos (mono > fluoro > braid)
   sensBonus sensibilidad añadida (braid transmite mejor) */
PF.GEAR_LINES = [
  { id: 'line_paleon_mono4', brand: 'paleon', name: 'Paleon Mono 4 kg', kind: 'Mono', test: 4, vis: 0.5, stretch: 0.6, sensBonus: 0, abr: 0.3, price: 0, level: 1 },
  { id: 'line_xena_fluoro3', brand: 'xenacanth', name: 'Xenacanth Ghost Fluoro 3 kg', kind: 'Fluoro', test: 3, vis: 0.12, stretch: 0.35, sensBonus: 0.05, abr: 0.5, price: 160, level: 1 },
  { id: 'line_strata_mono8', brand: 'strata', name: 'Strata Mono 8 kg', kind: 'Mono', test: 8, vis: 0.55, stretch: 0.6, sensBonus: 0, abr: 0.35, price: 240, level: 2 },
  { id: 'line_aegis_braid15', brand: 'aegis', name: 'Aegis Weave Braid 15 kg', kind: 'Braid', test: 15, vis: 0.8, stretch: 0.08, sensBonus: 0.15, abr: 0.45, price: 560, level: 3 },
  { id: 'line_aegis_braid40', brand: 'aegis', name: 'Aegis Weave Braid 40 kg', kind: 'Braid', test: 40, vis: 0.9, stretch: 0.06, sensBonus: 0.15, abr: 0.55, price: 1300, level: 4 }
];

/* LEADERS
   bite      resistencia a dientes (0..1). Se compara con species.teeth.
   vis       visibilidad añadida */
PF.GEAR_LEADERS = [
  { id: 'leader_none', brand: 'paleon', name: 'Sin leader', kind: '—', bite: 0.0, vis: 0, price: 0, level: 1 },
  { id: 'leader_aegis_fluoro', brand: 'aegis', name: 'Aegis Fluoro Leader 10 kg', kind: 'Fluoro', bite: 0.35, vis: 0.05, price: 190, level: 1 },
  { id: 'leader_aegis_wire', brand: 'aegis', name: 'Aegis Wire 20 kg', kind: 'Wire', bite: 0.8, vis: 0.35, price: 420, level: 2 },
  { id: 'leader_aegis_titan', brand: 'aegis', name: 'Aegis Titanium 45 kg', kind: 'Titanium', bite: 0.97, vis: 0.25, price: 1250, level: 4 }
];

/* MONTAJES (rigs) — definen la TÉCNICA de pesca (v0.2)
   float   boya: el cebo cuelga a la profundidad elegida (floatDepth)
   bottom  plomo: el cebo descansa en el fondo; la picada se ve en la puntera
   lure    grapa/emerillón: para señuelos artificiales (spinning)
   Los cebos naturales son compatibles con float/bottom; los señuelos solo
   con lure. PF.fixCompat() corrige combinaciones inválidas al equipar. */
PF.GEAR_RIGS = [
  { id: 'rig_float', brand: 'paleon', name: 'Boya de corteza Paleon', kind: 'Boya', rig: 'float', sens: 0.8, price: 0, level: 1 },
  { id: 'rig_lure', brand: 'aegis', name: 'Grapa Aegis Snap #2', kind: 'Señuelo', rig: 'lure', sens: 0.6, price: 0, level: 1 },
  { id: 'rig_bottom', brand: 'paleon', name: 'Plomo de piedra Paleon 20 g', kind: 'Fondo', rig: 'bottom', sens: 0.5, price: 120, level: 1 },
  { id: 'rig_float_pro', brand: 'xenacanth', name: 'Xenacanth Pluma Waggler', kind: 'Boya', rig: 'float', sens: 1.0, price: 320, level: 2 },
  { id: 'rig_bottom_feeder', brand: 'mawsonia', name: 'Mawsonia Feeder 40 g', kind: 'Fondo', rig: 'bottom', sens: 0.75, price: 520, level: 3 }
];

/* CEBOS Y SEÑUELOS
   tech      'natural' (para boya o fondo) | 'spin' (señuelo artificial)
   attract   perfil frente a species.diet
   size      tamaño relativo: cebos grandes filtran peces pequeños
   uses      usos (cebos naturales); null = infinito
   --- solo señuelos ---
   lureType  spinner | spoon | minnow | jerk | jig | swim  (modelo 3D + física)
   sink      m/s que se hunde parado (negativo = flota y sube)
   dive      profundidad a la que "bucea" al recoger (minnows/crankbaits)
   styles    multiplicador de picada por estilo de recogida (ver retrieve.js):
             still · slow · uniform · fast · stopgo · twitch · liftdrop */
PF.GEAR_BAITS = [
  { id: 'bait_worm', brand: 'paleon', name: 'Anélido de ribera', kind: 'Cebo natural', tech: 'natural', attract: { invert: 1.0 }, size: 0.15, uses: 20, price: 40, color: '#b0604a', level: 1 },
  { id: 'bait_shrimp', brand: 'paleon', name: 'Crustáceo de agua dulce', kind: 'Cebo natural', tech: 'natural', attract: { invert: 0.9, fish: 0.2 }, size: 0.3, uses: 15, price: 60, color: '#d08a5a', level: 1 },
  { id: 'bait_deadfish', brand: 'gondwana', name: 'Paleonisco muerto', kind: 'Cebo natural', tech: 'natural', attract: { fish: 1.0 }, size: 0.75, uses: 6, price: 150, color: '#b8b090', level: 2 },
  { id: 'lure_spinner', brand: 'strata', name: 'Strata Flicker Spinner #2', kind: 'Spinner', tech: 'spin', lureType: 'spinner', attract: { flash: 1.0, fish: 0.2 }, size: 0.25, sink: 0.45, styles: { slow: 1.1, uniform: 1.4, fast: 1.0, stopgo: 0.9, twitch: 0.5, liftdrop: 0.4, still: 0.1 }, uses: null, price: 0, color: '#e0c060', level: 1 },
  { id: 'lure_spoon', brand: 'paleon', name: 'Paleon Ámbar Spoon 10 g', kind: 'Cucharilla', tech: 'spin', lureType: 'spoon', attract: { flash: 0.9, fish: 0.4 }, size: 0.4, sink: 0.9, styles: { slow: 1.0, uniform: 1.0, fast: 0.8, stopgo: 1.5, twitch: 0.8, liftdrop: 1.1, still: 0.15 }, uses: null, price: 180, color: '#e6a33a', level: 1 },
  { id: 'lure_jig', brand: 'strata', name: 'Strata Jig de hueso 7 g', kind: 'Jig', tech: 'spin', lureType: 'jig', attract: { invert: 0.6, swim: 0.5, fish: 0.4 }, size: 0.3, sink: 1.4, styles: { slow: 0.7, uniform: 0.5, fast: 0.3, stopgo: 1.0, twitch: 0.9, liftdrop: 1.7, still: 0.35 }, uses: null, price: 220, color: '#e9dcb8', level: 1 },
  { id: 'lure_minnow', brand: 'xenacanth', name: 'Xenacanth Paleo-Minnow 9 cm', kind: 'Minnow flotante', tech: 'spin', lureType: 'minnow', attract: { swim: 1.0, fish: 0.6 }, size: 0.55, sink: -0.35, dive: 1.3, styles: { slow: 1.0, uniform: 1.1, fast: 0.8, stopgo: 1.5, twitch: 1.3, liftdrop: 0.5, still: 0.2 }, uses: null, price: 420, color: '#9fb08a', level: 2 },
  { id: 'lure_jerk', brand: 'kaykay', name: 'Kaykay Shard Jerkbait 11 cm', kind: 'Jerkbait suspending', tech: 'spin', lureType: 'jerk', attract: { swim: 1.0, fish: 0.8, flash: 0.4 }, size: 0.6, sink: 0.02, dive: 1.6, styles: { slow: 0.6, uniform: 0.6, fast: 0.5, stopgo: 1.0, twitch: 1.9, liftdrop: 0.6, still: 0.45 }, uses: null, price: 880, color: '#c9d0b0', level: 3 },
  { id: 'lure_swimbait', brand: 'helicoprion', name: 'Helicoprion Spiral Swimbait 18 cm', kind: 'Swimbait', tech: 'spin', lureType: 'swim', attract: { swim: 1.0, fish: 1.0 }, size: 0.9, sink: 0.6, styles: { slow: 1.7, uniform: 1.2, fast: 0.6, stopgo: 0.9, twitch: 0.6, liftdrop: 0.7, still: 0.1 }, uses: null, price: 1450, color: '#c7b27a', level: 3 }
];

/* Velocidades de manivela (marchas 1..5), multiplican reel.speed */
PF.REEL_SPEEDS = [0.35, 0.55, 0.75, 1.0, 1.35];

/* Corrige combinaciones montaje/cebo inválidas. changed = 'rig'|'bait' */
PF.fixCompat = function (d, changed) {
  var rig = PF.findGear(d.equip.rig), bait = PF.findGear(d.equip.bait);
  var lureRig = rig.rig === 'lure', lureBait = bait.tech === 'spin';
  if (lureRig === lureBait) return;
  if (changed === 'bait') {
    if (lureBait) d.equip.rig = 'rig_lure';
    else d.equip.rig = d.owned.indexOf(d.lastNaturalRig) >= 0 ? d.lastNaturalRig : 'rig_float';
  } else {
    var pick = null;
    PF.GEAR_BAITS.forEach(function (b) {
      if (pick || d.owned.indexOf(b.id) < 0) return;
      if (lureRig ? b.tech === 'spin' : (b.tech === 'natural' && (d.baitStock[b.id] || 0) > 0)) pick = b.id;
    });
    if (pick) d.equip.bait = pick; else d.equip.rig = lureRig ? 'rig_float' : 'rig_lure';
  }
  if (PF.findGear(d.equip.rig).rig !== 'lure') d.lastNaturalRig = d.equip.rig;
};

/* Utilidad: buscar un objeto por id en cualquier categoría */
PF.findGear = function (id) {
  var all = [].concat(PF.GEAR_RODS, PF.GEAR_REELS, PF.GEAR_LINES, PF.GEAR_LEADERS, PF.GEAR_RIGS, PF.GEAR_BAITS);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
};

PF.GEAR_CATEGORIES = [
  { key: 'rod', label: 'Cañas', list: function () { return PF.GEAR_RODS; } },
  { key: 'reel', label: 'Carretes', list: function () { return PF.GEAR_REELS; } },
  { key: 'line', label: 'Líneas', list: function () { return PF.GEAR_LINES; } },
  { key: 'leader', label: 'Leaders', list: function () { return PF.GEAR_LEADERS; } },
  { key: 'rig', label: 'Montajes', list: function () { return PF.GEAR_RIGS; } },
  { key: 'bait', label: 'Cebos/Señuelos', list: function () { return PF.GEAR_BAITS; } }
];
