# Primeval Fishing — Registro de trabajo y plan (para la siguiente IA)

Lee también `docs/DESIGN_DECISIONS.md` (el porqué) y los documentos originales del usuario:
`pesca_prehistorica_zonas_y_reglas_v1.txt` (18 zonas, reglas paleoecológicas) y
`pool_de_objetos_marcas_y_equipo_pesca_prehistorica.txt` (marcas y familias de equipo). No están
en el repo; se los pasaron a la IA en un ZIP. Lo esencial ya está volcado en `js/data/*`.

## Cómo ejecutar
```
python3 -m http.server 8080   # y abre http://localhost:8080
```
También funciona abriendo `index.html` directamente (el audio usa `<audio>` de respaldo).
Depuración en consola: `PF.Game.fishing.debug.bite('rhizodus', 40)` (después de lanzar) ·
`PF.Game.fastTime = true` · `PF.Save.reset()` · visor de modelos: `/tools/fish-viewer.html`.

## Mapa del código (orden de carga = `index.html`)
| Archivo | Responsabilidad |
|---|---|
| `js/core/util.js` | ruido, RNG con semilla, lerp, formateo |
| `js/core/save.js` | guardado en localStorage versionado (`SAVE_VERSION` + `migrate()`) |
| `js/core/audio.js` | samples, bucles (carrete/freno/ambiente), música |
| `js/data/species.js` | especies (stats, dieta, actividad, `look` para el modelo) |
| `js/data/gear.js` | marcas, cañas, carretes, líneas, leaders, **montajes**, cebos/señuelos, `fixCompat` |
| `js/data/zones.js` | zonas: relieve `heightAt`, microhábitats, pool, puestos, paleta |
| `js/world/sky.js` | cielo, montañas, volcán, ciclo día/noche (`KEYS`) |
| `js/world/terrain.js` | terreno con colores por vértice + shader de agua con ondas |
| `js/world/vegetation.js` | flora del Carbonífero instanciada + rocas |
| `js/world/fishmesh.js` | generador procedural de peces |
| `js/world/lures.js` | modelos y animación de señuelos y boya |
| `js/game/input.js` | teclado/ratón/táctil → eventos (`actionDown`, `twitch`, `reelGear`, `drag`, `floatDepth`…) |
| `js/game/retrieve.js` | detector del estilo de recogida |
| `js/game/fishing.js` | máquina de estados de la pesca, combate, encuentros, telemetría `tele` |
| `js/game/player.js` | primera persona |
| `js/game/ui.js` | pantallas, tienda, códex, HUD vivo (`liveHud`) |
| `js/main.js` | arranque, bucle, calidad adaptativa, menús |

## Historial
- **v0.1** — base: Wardie (zona 01), 14 especies, pool básico de equipo, lance/picada/combate, tienda, códex, día/noche, PC + móvil.
- **v0.2** (esta versión) — feedback del usuario:
  - Peces rehechos (perfil, escamas ganoideas, ojos, aletas con radios, Phong).
  - Bug de las rocas corregido.
  - HUD tipo Fishing Planet (indicadores de carga, freno en %, marcha, distancia, profundidad, estado de recogida).
  - Técnicas: boya / fondo / señuelo + 6 estilos de recogida detectados + 7 señuelos con física propia.
  - Audio: solo samples (ElevenLabs) + tema de Fishing Planet como música.

## Pendiente / siguientes pasos sugeridos (por prioridad)
1. **Pulido del combate**: animación del pez en superficie al final (salto/cabeceo), cámara que siga brevemente al pez, retenida/rejón (*landing net*) con un minijuego corto para piezas trofeo.
2. **Más señuelos y colores** (doc del pool: 500-800 variantes como familias `{base, colores[], tamaños[]}`), efecto del color según la luz y la turbidez.
3. **Clima** (doc de zonas §12): lluvia/niebla que cambien la visibilidad, la actividad y el color del agua. Hoy solo existe el ciclo día/noche.
4. **Barca** (pesca en el canal) y vadeo más profundo.
5. **Zona 02 Bear Gulch**: copiar el bloque `wardie` de `zones.js` (relieve, paleta marina, pool). El motor no tiene nada propio de Wardie.
6. Misiones/contratos, licencias y keepnet (ya existe `save.keepnet`, sin usar).
7. Sonar/eco-sonda (equipo de Helicoprion) para ver bancos.
8. PWA (service worker) para instalarlo offline en el móvil.

## Convenciones
- Comentarios y textos de UI en español. Código sin minificar, ES5 (`var`, funciones), para que sea compatible y fácil de editar.
- Cada objeto de datos documenta sus campos en el comentario de cabecera del archivo.
- No mezclar especies imposibles (regla de oro del documento de zonas).
