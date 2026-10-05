/* =====================================================================
   PRIMEVAL FISHING — BASE DE DATOS DE ESPECIES
   ---------------------------------------------------------------------
   Cada especie sigue el formato definido en docs/DESIGN_DECISIONS.md.
   Las especies NO se asignan a zonas aquí: las zonas (zones.js) declaran
   qué especies contienen y con qué pesos por microhábitat. Así una misma
   especie puede reutilizarse en otra zona solo si es paleoecológicamente
   coherente (regla de oro del documento de zonas).

   Campos:
     id          identificador interno
     name        nombre común de juego (ES)
     sci         nombre científico (respetando la incertidumbre taxonómica)
     group       grupo para el códex
     tags        tags ecológicos (ver doc de zonas, sección 6)
     weight      [min, max] kg del rango PESCABLE (regla de juveniles)
     rarity      peso base en el pool (más alto = más común)
     diet        afinidad por tipo de cebo: invert, fish, flash, swim (0..1)
     strength    fuerza relativa por kg (multiplica la tracción)
     stamina     resistencia relativa
     jumpy       probabilidad de saltos / sacudidas en superficie
     teeth       riesgo de cortar líneas no metálicas (0..1)
     activity    multiplicadores por franja: dawn, day, dusk, night
     value       ámbar por kg
     star        true si es pez estrella de su zona
     look        parámetros del generador de mallas (fishmesh.js)
   ===================================================================== */
window.PF = window.PF || {};

PF.SPECIES = {
  rhadinichthys: {
    id: 'rhadinichthys', name: 'Rhadinichthys', sci: 'Rhadinichthys spp. (brevis, carinatus, ferox, ornatissimus)',
    group: 'Actinopterigio paleonisciforme',
    tags: ['FRESHWATER', 'BRACKISH', 'LAGOONAL', 'SCHOOLING', 'SHALLOW'],
    weight: [0.04, 0.45], rarity: 100,
    diet: { invert: 1.0, fish: 0.05, flash: 0.45, swim: 0.2 },
    strength: 1.0, stamina: 0.7, jumpy: 0.3, teeth: 0,
    activity: { dawn: 1.2, day: 1.0, dusk: 1.2, night: 0.4 },
    value: 22, star: false,
    desc: 'Pequeño paleonisciforme de escamas romboidales ganoideas. Forma bancos enormes en las aguas someras de Wardie y es la base de la cadena trófica.',
    look: { len: 1.0, depth: 0.22, top: '#4d5a3a', belly: '#d9c79a', fin: '#8a6a3a', pattern: 'scales', tail: 'hetero', lobed: false }
  },
  acanthodes: {
    id: 'acanthodes', name: 'Acanthodes', sci: 'Acanthodes sulcatus',
    group: 'Acantodio ("tiburón espinoso")',
    tags: ['FRESHWATER', 'BRACKISH', 'LAGOONAL', 'FILTER_FEEDER', 'PELAGIC', 'SCHOOLING'],
    weight: [0.05, 0.6], rarity: 70,
    diet: { invert: 0.9, fish: 0.0, flash: 0.3, swim: 0.1 },
    strength: 0.9, stamina: 0.8, jumpy: 0.15, teeth: 0,
    activity: { dawn: 1.1, day: 1.0, dusk: 1.1, night: 0.6 },
    value: 26, star: false,
    desc: 'Acantodio sin dientes que filtraba plancton. Sus aletas están sostenidas por espinas rígidas: cuidado al desengancharlo.',
    look: { len: 1.0, depth: 0.18, top: '#5b5f4a', belly: '#cfc3a0', fin: '#6b5435', pattern: 'plain', tail: 'hetero', spines: true, lobed: false }
  },
  elonichthys: {
    id: 'elonichthys', name: 'Elonichthys', sci: 'Elonichthys robisoni / E. striatulus',
    group: 'Actinopterigio paleonisciforme',
    tags: ['FRESHWATER', 'LAGOONAL', 'ACTIVE_PREDATOR'],
    weight: [0.1, 1.3], rarity: 55,
    diet: { invert: 0.7, fish: 0.4, flash: 0.8, swim: 0.6 },
    strength: 1.15, stamina: 1.0, jumpy: 0.4, teeth: 0.02,
    activity: { dawn: 1.4, day: 0.9, dusk: 1.4, night: 0.5 },
    value: 30, star: false,
    desc: 'Paleonisciforme alargado, cazador activo de invertebrados y alevines. Muy agresivo con cucharillas y spinners al amanecer.',
    look: { len: 1.0, depth: 0.2, top: '#3f5040', belly: '#e0cf9e', fin: '#9b6b33', pattern: 'scales', tail: 'hetero', lobed: false }
  },
  gonatodus: {
    id: 'gonatodus', name: 'Gonatodus', sci: 'Gonatodus punctatus',
    group: 'Actinopterigio paleonisciforme',
    tags: ['FRESHWATER', 'LAGOONAL', 'VEGETATION_ASSOCIATED'],
    weight: [0.1, 0.8], rarity: 45,
    diet: { invert: 1.0, fish: 0.05, flash: 0.3, swim: 0.2 },
    strength: 1.0, stamina: 0.9, jumpy: 0.2, teeth: 0,
    activity: { dawn: 1.1, day: 1.1, dusk: 1.0, night: 0.5 },
    value: 32, star: false,
    desc: 'Paleonisciforme moteado que se refugia entre la vegetación sumergida.',
    look: { len: 1.0, depth: 0.25, top: '#55502e', belly: '#e3d2a2', fin: '#7a5a2a', pattern: 'spots', tail: 'hetero', lobed: false }
  },
  wardichthys: {
    id: 'wardichthys', name: 'Wardichthys', sci: 'Wardichthys cyclosoma',
    group: 'Actinopterigio paleonisciforme',
    tags: ['FRESHWATER', 'LAGOONAL', 'VEGETATION_ASSOCIATED'],
    weight: [0.08, 0.6], rarity: 35,
    diet: { invert: 1.0, fish: 0.0, flash: 0.2, swim: 0.1 },
    strength: 0.9, stamina: 0.9, jumpy: 0.15, teeth: 0,
    activity: { dawn: 1.0, day: 1.2, dusk: 1.0, night: 0.4 },
    value: 40, star: false,
    desc: 'Pez de cuerpo redondeado, conocido casi exclusivamente de los niveles de Wardie. Un clásico local.',
    look: { len: 1.0, depth: 0.34, top: '#615a35', belly: '#e9d9ab', fin: '#a07a3c', pattern: 'scales', tail: 'hetero', lobed: false }
  },
  eurynotus: {
    id: 'eurynotus', name: 'Eurynotus', sci: 'Eurynotus crenatus',
    group: 'Actinopterigio de cuerpo alto',
    tags: ['FRESHWATER', 'LAGOONAL', 'DUROPHAGOUS', 'BENTHIC'],
    weight: [0.2, 2.2], rarity: 30,
    diet: { invert: 1.0, fish: 0.1, flash: 0.15, swim: 0.1 },
    strength: 1.25, stamina: 1.2, jumpy: 0.1, teeth: 0,
    activity: { dawn: 1.0, day: 1.0, dusk: 1.2, night: 0.9 },
    value: 38, star: false,
    desc: 'Cuerpo alto y comprimido, dientes para triturar conchas. Prefiere cebos de crustáceo en el fondo.',
    look: { len: 1.0, depth: 0.38, top: '#4a4430', belly: '#d8c08a', fin: '#7e5a2e', pattern: 'scales', tail: 'hetero', lobed: false }
  },
  cosmoptychius: {
    id: 'cosmoptychius', name: 'Cosmoptychius', sci: 'Cosmoptychius striatus',
    group: 'Actinopterigio paleonisciforme',
    tags: ['FRESHWATER', 'LAGOONAL', 'ACTIVE_PREDATOR'],
    weight: [0.2, 1.6], rarity: 28,
    diet: { invert: 0.5, fish: 0.7, flash: 0.8, swim: 0.8 },
    strength: 1.2, stamina: 1.1, jumpy: 0.45, teeth: 0.05,
    activity: { dawn: 1.3, day: 0.9, dusk: 1.4, night: 0.6 },
    value: 42, star: false,
    desc: 'Paleonisciforme estriado de tamaño medio, depredador oportunista.',
    look: { len: 1.0, depth: 0.22, top: '#3a4a3c', belly: '#dccb9a', fin: '#a66f2e', pattern: 'stripes', tail: 'hetero', lobed: false }
  },
  onychoselache: {
    id: 'onychoselache', name: 'Onychoselache', sci: 'Onychoselache traquairi',
    group: 'Condrictio hibodontiforme',
    tags: ['FRESHWATER', 'BRACKISH', 'LAGOONAL', 'BENTHIC'],
    weight: [0.2, 1.5], rarity: 14,
    diet: { invert: 0.9, fish: 0.3, flash: 0.2, swim: 0.3 },
    strength: 1.3, stamina: 1.3, jumpy: 0.05, teeth: 0.1,
    activity: { dawn: 1.0, day: 0.7, dusk: 1.2, night: 1.5 },
    value: 70, star: false,
    desc: 'Pequeño tiburón de aletas pectorales robustas, quizá capaz de "caminar" sobre el fondo.',
    look: { len: 1.0, depth: 0.16, top: '#5d5848', belly: '#cdbf9c', fin: '#5d5848', pattern: 'plain', tail: 'shark', dorsalSpine: true, lobed: false }
  },
  diplodoselache: {
    id: 'diplodoselache', name: 'Diplodoselache', sci: 'Diplodoselache woodi',
    group: 'Condrictio xenacántido',
    tags: ['FRESHWATER', 'LAGOONAL', 'AMBUSH_PREDATOR', 'BENTHIC'],
    weight: [0.8, 6], rarity: 10,
    diet: { invert: 0.3, fish: 0.9, flash: 0.4, swim: 0.7 },
    strength: 1.4, stamina: 1.4, jumpy: 0.1, teeth: 0.3,
    activity: { dawn: 1.1, day: 0.6, dusk: 1.4, night: 1.7 },
    value: 75, star: false,
    desc: 'Uno de los xenacántidos más antiguos: tiburón de agua dulce con espina cefálica. Activo en la penumbra.',
    look: { len: 1.0, depth: 0.14, top: '#4d4a3e', belly: '#c9b993', fin: '#4d4a3e', pattern: 'plain', tail: 'diphy', headSpine: true, lobed: false }
  },
  sphenacanthus: {
    id: 'sphenacanthus', name: 'Sphenacanthus', sci: 'Sphenacanthus serrulatus',
    group: 'Condrictio ctenacántido',
    tags: ['FRESHWATER', 'BRACKISH', 'LAGOONAL', 'ACTIVE_PREDATOR'],
    weight: [2, 15], rarity: 6,
    diet: { invert: 0.2, fish: 1.0, flash: 0.5, swim: 0.8 },
    strength: 1.5, stamina: 1.5, jumpy: 0.1, teeth: 0.35,
    activity: { dawn: 1.2, day: 0.7, dusk: 1.3, night: 1.3 },
    value: 80, star: false,
    desc: 'Tiburón con espinas dorsales aserradas. Largas carreras por el canal profundo.',
    look: { len: 1.0, depth: 0.17, top: '#57584a', belly: '#d1c4a0', fin: '#57584a', pattern: 'plain', tail: 'shark', dorsalSpine: true, lobed: false }
  },
  lungfish: {
    id: 'lungfish', name: 'Pez pulmonado', sci: 'Dipnoi indet.',
    group: 'Sarcopterigio dipnoo',
    tags: ['FRESHWATER', 'LAGOONAL', 'LOW_OXYGEN_TOLERANT', 'BENTHIC', 'DUROPHAGOUS'],
    weight: [1, 9], rarity: 8,
    diet: { invert: 1.0, fish: 0.4, flash: 0.05, swim: 0.1 },
    strength: 1.2, stamina: 1.6, jumpy: 0.05, teeth: 0.05,
    activity: { dawn: 0.9, day: 0.8, dusk: 1.2, night: 1.5 },
    value: 85, star: false,
    desc: 'Dipnoo de identidad indeterminada. Lento, testarudo, se aferra al fondo. Taxón indeterminado conservado a propósito.',
    look: { len: 1.0, depth: 0.17, top: '#5e5236', belly: '#cdb88a', fin: '#6e5a33', pattern: 'spots', tail: 'diphy', lobed: true }
  },
  nematoptychius: {
    id: 'nematoptychius', name: 'Nematoptychius', sci: 'Nematoptychius greenocki',
    group: 'Actinopterigio depredador',
    tags: ['FRESHWATER', 'LAGOONAL', 'AMBUSH_PREDATOR', 'VEGETATION_ASSOCIATED'],
    weight: [0.8, 4.5], rarity: 9,
    diet: { invert: 0.1, fish: 1.0, flash: 0.9, swim: 1.0 },
    strength: 1.45, stamina: 1.2, jumpy: 0.6, teeth: 0.2,
    activity: { dawn: 1.5, day: 0.8, dusk: 1.6, night: 0.7 },
    value: 110, star: true,
    desc: 'ESTRELLA. Depredador de emboscada de ~medio metro, hocico alargado y dientes cónicos. Ataca minnows con violencia junto a los herbazales.',
    look: { len: 1.0, depth: 0.15, top: '#36452f', belly: '#e2d09c', fin: '#b0702a', pattern: 'stripes', tail: 'hetero', snout: 1.4, lobed: false }
  },
  megalichthys: {
    id: 'megalichthys', name: 'Megalichthys', sci: 'Megalichthys sp.',
    group: 'Sarcopterigio megaliquíido',
    tags: ['FRESHWATER', 'LAGOONAL', 'ACTIVE_PREDATOR', 'DEEP'],
    weight: [3, 28], rarity: 3.2,
    diet: { invert: 0.05, fish: 1.0, flash: 0.5, swim: 0.9 },
    strength: 1.6, stamina: 1.6, jumpy: 0.25, teeth: 0.55,
    activity: { dawn: 1.4, day: 0.6, dusk: 1.5, night: 1.2 },
    value: 140, star: true,
    desc: 'ESTRELLA. Sarcopterigio de escamas brillantes de cosmina y aletas lobuladas. Su mordida destroza líneas finas.',
    look: { len: 1.0, depth: 0.17, top: '#5a4a2c', belly: '#e6cf98', fin: '#8e5c26', pattern: 'scales', tail: 'diphy', lobed: true, shine: true }
  },
  rhizodus: {
    id: 'rhizodus', name: 'Rhizodus', sci: 'Rhizodus hibberti',
    group: 'Sarcopterigio rizodonte',
    tags: ['FRESHWATER', 'LAGOONAL', 'AMBUSH_PREDATOR', 'DEEP', 'VEGETATION_ASSOCIATED'],
    weight: [12, 160], rarity: 0.9,
    diet: { invert: 0.0, fish: 1.0, flash: 0.25, swim: 0.7 },
    strength: 1.9, stamina: 2.0, jumpy: 0.12, teeth: 0.9,
    activity: { dawn: 1.3, day: 0.5, dusk: 1.6, night: 1.4 },
    value: 220, star: true, apex: true,
    desc: 'ESTRELLA / APEX. El mayor depredador del río. Los colmillos pueden superar 20 cm en adultos; solo juveniles y subadultos son pescables. Los adultos se ven, no se pescan.',
    look: { len: 1.0, depth: 0.17, top: '#3d3a28', belly: '#c9b07a', fin: '#5a4526', pattern: 'spots', tail: 'diphy', lobed: true, fangs: true }
  }
};

/* Categorías de captura (doc de zonas, sección 3).
   Se calculan con el percentil del peso dentro del rango pescable. */
PF.CATEGORIES = [
  { id: 'common', name: 'Común', min: 0.0, color: '#d8c79f', mult: 1.0 },
  { id: 'large', name: 'Grande', min: 0.55, color: '#9fd27a', mult: 1.3 },
  { id: 'trophy', name: 'Trofeo', min: 0.82, color: '#f0b54a', mult: 2.0 },
  { id: 'ancient', name: 'Ancestral', min: 0.965, color: '#ff6b3d', mult: 4.0 }
];

PF.categoryFor = function (species, kg) {
  var r = (kg - species.weight[0]) / (species.weight[1] - species.weight[0]);
  var cat = PF.CATEGORIES[0];
  for (var i = 0; i < PF.CATEGORIES.length; i++) {
    if (r >= PF.CATEGORIES[i].min) cat = PF.CATEGORIES[i];
  }
  return cat;
};

/* Genera un peso sesgado hacia ejemplares pequeños (distribución
   potencial). Los ancestrales son, por diseño, rarísimos. */
PF.rollWeight = function (species, bias) {
  var u = Math.random();
  var p = Math.pow(u, 2.6 - (bias || 0));
  return species.weight[0] + (species.weight[1] - species.weight[0]) * p;
};
