# Primeval Fishing — Justificación de decisiones de diseño

Documento vivo. Cada decisión: **qué** se hizo y **por qué**. Más reciente arriba en cada sección.

---

## 1. Tecnología

| Decisión | Por qué |
|---|---|
| **three.js r149 (build UMD no minificado, `js/lib/three.js`)** | Última versión con build UMD global → funciona con `<script>` clásicos, sin bundler ni módulos ES. El usuario pidió HTML editable y sin minificar. |
| **Sin módulos ES, namespace global `PF`** | Abrir `index.html` con doble clic (`file://`) no permite módulos ES. Con scripts clásicos el juego funciona offline sin servidor (el audio usa `<audio>` de respaldo en `file://`). |
| **Geometría procedural, cero modelos/texturas externas** | Peso mínimo (móvil), estética plana pedida, y cualquier IA puede editar formas en código. |
| **Colores por vértice + Lambert/Phong** | Shading barato; el "ruido" visual se controla exactamente → look pintado y plano. |
| **InstancedMesh para la vegetación** | 1 draw call por tipo de planta. Miles de plantas a 60 fps en móvil medio. |
| **UI en DOM/CSS sobre el canvas** | Más nítida que WebGL, accesible, fácil de editar y escalar con `clamp()`/`vh`. |
| **Sin `outputEncoding = sRGB`** | Con r149 en modo "legacy" las paletas hex se ven exactamente como se escriben; sRGB lavaba los colores (bug v0.1). |

## 2. Rendimiento PC / móvil

- Calidad `auto`: táctil + pantalla < 900 px → **LOW** (menos resolución de terreno, 55 % de vegetación, sin antialias, pixelRatio ≤ 1.25).
- **Escalado dinámico**: si los FPS < 40 durante 4 s se baja el `pixelRatio` en pasos de 0.25.
- El agua no usa reflejos reales: ondas analíticas + fresnel hacia el color del cielo (1 pasada).
- Música por `<audio>` en streaming (no se decodifica entero en RAM).

## 3. Estética prehistórica

- **Paleta cálida**: ocres, ámbar, verdes oliva, horizonte melocotón. El Viseano escocés estaba cerca del ecuador → atmósfera húmeda, tropical, neblinosa. La niebla es cálida (no gris) para dar "aire denso".
- **Perspectiva atmosférica en 3 capas de montañas** (+ volcán humeante). Cada capa se mezcla más con la niebla → profundidad de cuadro pintado. El volcán está justificado: el Carbonífero de Edimburgo era volcánico (Arthur's Seat es un volcán de esa edad).
- **Flora correcta del Carbonífero**: Lepidodendron (árbol escamoso con cicatrices romboidales), Calamites (equisetos gigantes segmentados), helechos y pteridospermas, licopodios en la orilla. **No hay hierba ni flores ni nenúfares** (no existían) → esteras de algas flotantes.
- **UI "piedra + cuero + ámbar"**: losas con bordes irregulares (border-radius asimétrico), puntadas de cuero, el ámbar como moneda (◈). Tipografías Cinzel (inscripción) + Alegreya Sans (lectura), con licencia OFL e incluidas en local.
- La caja de aparejos se inspira en `roksana-nikicionek-1ui.jpg` (caja verde con compartimentos y pestañas).

## 4. Modelos

### Peces (`js/world/fishmesh.js`) — v0.2, reescritos tras el feedback "son feos"
- Perfil hidrodinámico `u^a(1-u)^b` (máximo hacia el 40 %, hocico afilado, pedúnculo caudal marcado).
- Sección superelipse (lomo redondeado, vientre algo plano), **normales suaves**.
- **Escamas ganoideas romboidales** pintadas (rasgo real de paleonisciformes y sarcopterigios), contrasombreado, línea lateral, opérculo sutil y ojos ámbar en 3D.
- Colas correctas por grupo: **heterocerca** (paleoniscos, tiburones) y **dificerca** (sarcopterigios, dipnoos). Aletas pares **lobuladas** en sarcopterigios. Espinas en acantodios/ctenacántidos, espina cefálica en xenacántidos, colmillos en Rhizodus.
- Herramienta: `tools/fish-viewer.html` muestra todas las especies y señuelos.

### Rocas — bug v0.1 corregido
`DodecahedronGeometry` no está indexado: cada cara tenía vértices propios y la deformación por **índice** abría grietas. Ahora es un icosaedro subdividido deformado por **posición** del vértice (los vértices compartidos se mueven igual), con base enterrada, cima erosionada y musgo arriba.

## 5. Jugabilidad

### Técnicas de pesca (v0.2)
Inspiradas en Fishing Planet. La **técnica la define el MONTAJE** (categoría "Montajes" en la caja):

| Montaje | Técnica | Feedback de picada | Favorece |
|---|---|---|---|
| Boya | Cebo a la profundidad elegida (Z/X o botones BOYA) | La boya tiembla y se hunde | peces de media agua |
| Fondo (plomo) | Cebo apoyado en el fondo | Puntera que vibra + campanilla | bentónicos/durófagos (×1.9) |
| Señuelo | Artificial, con física propia | Golpe directo durante la recogida | depredadores |

`PF.fixCompat()` impide combinaciones absurdas (señuelo con boya, gusano con grapa).

### Estilos de recogida con señuelo (`js/game/retrieve.js`)
En vez de un menú, el estilo **se detecta** a partir de lo que hace el jugador en los últimos 4 s (es más natural y funciona con un solo botón en móvil):
- *Uniforme / lenta / rápida* (mantener, según la marcha 1-5), *Pare y avance* (ciclos de mantener/soltar), *Twitching* (tirones F/TIRÓN), *Jigging* (tirones con el señuelo en el fondo), *Parado*.
- Cada señuelo tiene `styles{}` con multiplicadores: el spinner quiere uniforme, la cucharilla pare y avance, el jerkbait twitching, el jig jigging, el swimbait recogida lenta. El HUD muestra el estilo y ★ de eficacia → el jugador aprende sin tutorial.
- Física: `sink` (se hunde, suspende o flota), `dive` (los minnows bucean al recoger), los tirones adelantan y elevan el señuelo. Ataques extra justo al parar (clásico de pare y avance) y tras un tirón.

### Modelo de combate (adrenalina)
Ver la cabecera de `js/game/fishing.js`. Resumen: el pez alterna fases (carrera, descansa, sacudidas, hacia ti, agotado). El freno cede línea por encima de `drag × %`, la caña y la línea se rompen al superar su límite, los dientes cortan sin leader, la línea floja suelta el anzuelo y una bobina vacía también hace perder el pez. **Marchas altas** recogen más rápido pero añaden tensión. El tirón durante el combate ("bombeo") gana línea a cambio de un pico de tensión.

### HUD (v0.2, referencia: captura de Fishing Planet del usuario)
- Abajo en el centro: **3 indicadores circulares de carga** (caña / carrete / línea, en %, verde → ámbar → rojo y vibran al límite), distancia de línea y profundidad del señuelo / del pez + kg de tensión. El icono del carrete **gira al recoger** y gira al revés en ámbar cuando el freno cede.
- Derecha: **freno** (barra + % + kg), **marcha** (5 marcas), **profundidad de la boya**.
- Arriba: insignia con técnica + estilo detectado + ★ + "⟳" al recoger.
- Botón ACCIÓN con etiqueta contextual (LANZAR / RECOGER / ¡CLAVAR!) y botón TIRÓN en móvil.

## 6. Audio (v0.2)
- El usuario no quería los sonidos procedurales → **todo con samples**: carrete en bucle (pitch según marcha), freno en bucle (volumen según la línea que sale), lance, plop, salpicaduras, rotura, campanilla de fondo, clic de UI y ambiente de pantano tropical (insectos y libélulas gigantes, sin pájaros: no existían en el Carbonífero). Generados con ElevenLabs SFX y convertidos a mp3 mono de 96 kbps.
- **Música**: `music_theme.mp3`, el tema de Fishing Planet que dio el usuario (el usuario asume los derechos). Baja de volumen en combate.
- Se conservan del ZIP: olas, salpicadura grande, pasos.

## 7. Paleoecología
- Pool de Wardie tomado del documento de zonas (14 taxones). Los indeterminados se mantienen como tales ("Dipnoi indet.").
- **Rhizodus adulto = solo encuentro** (silueta patrullando + evento que roba capturas). Solo se pescan juveniles y subadultos (12-160 kg), según la "regla de juveniles".
- Distribución: forraje muy dominante (`rarity` 100-30) frente a estrellas (9-0.9), con pesos por microhábitat (bajíos, herbazal, laguna abierta, canal profundo, desembocadura).
