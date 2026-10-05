# Primeval Fishing

Juego 3D de **simulación de pesca prehistórica** en HTML puro, inspirado en Fishing Planet. Es para un solo jugador, funciona offline y está optimizado para PC y para móviles en horizontal.

## Jugar
```
python3 -m http.server 8080
# abre http://localhost:8080
```
(También se puede abrir `index.html` directamente.)

## Contenido actual (v0.2)
- Zona 01 **Wardie** (Carbonífero inferior, Escocia), con 14 especies documentadas y Rhizodus adulto como encuentro.
- Técnicas: **boya**, **fondo** y **señuelo**, con 6 estilos de recogida que se detectan automáticamente (uniforme, pare y avance, twitching, jigging…).
- HUD inspirado en Fishing Planet: carga de la caña, el carrete y la línea, freno, marcha, distancia y profundidad.
- 10 marcas ficticias, cañas, carretes, líneas, leaders, montajes y 8 cebos/señuelos.
- Ciclo día/noche, códex, tienda y guardado local.

## Documentación
- `docs/DESIGN_DECISIONS.md`: por qué se tomó cada decisión.
- `docs/AI_HANDOFF.md`: mapa del código, historial y próximos pasos.
