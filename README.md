# EcoÁrbol — Propagación de especies invasoras con árboles n-arios

## Caso de estudio

Las especies invasoras amenazan los ecosistemas altoandinos: una sola planta que llega a un lugar
nuevo puede cubrir praderas, lagunas y bosques en pocas generaciones. Un equipo ambiental necesita
saber **quién propagó a quién**: qué tan rápido avanza cada especie, hasta dónde llegó, qué
individuos fueron los más prolíficos y qué pasa si se elimina un linaje completo o si un incendio
arrasa una zona.

La propagación es **jerárquica**: cada planta suelta semillas que se convierten en varias plantas
hijas. Por eso cada especie se modela con un **árbol n-ario** (como un árbol genealógico):

| Concepto | En EcoÁrbol |
|---|---|
| Raíz | Organismo fundador de la especie |
| Nodo | Cada organismo que logró establecerse |
| Padre / Hijo | Planta que soltó la semilla / planta que nació de ella |
| Hermanos | Organismos nacidos de la misma planta |
| Rama / Hoja | Organismo con descendencia (no raíz) / sin descendencia |
| Nivel | Generación (la raíz está en el nivel 1) |
| Altura | Número de generaciones del árbol |
| Peso | Total de organismos registrados (vivos y muertos) |
| Orden | Rasgo de la especie: máximo de hijos por organismo |
| Grado | Hijos de un nodo; el grado del árbol es el mayor |
| Subárbol / Poda | Un linaje completo / eliminarlo para controlar la especie |

Hay un catálogo de **8 especies** con estrategias distintas (colonizadoras, longevas, viajeras del
viento, acuática, especialista de roca…). Se pueden simular **de 1 a 8 a la vez** y ajustar sus rasgos.

## Modelo físico

- Mapa de hexágonos (coordenadas *odd-r*); la distancia entre centros vecinos es 1.
- Dispersión por **advección-difusión**: `Δx = s·v_viento·Δt + ξ`, `ξ ~ N(0, 2DΔt)`. El salto se calcula
  en el espacio continuo y se ajusta al hexágono donde cae.
- Difusión estimada con las aristas del árbol: `D ≈ (σx² + σy²) / 4`.
- Velocidad teórica del frente (Fisher-KPP): `v = 2√(r·D)`, usada como cota superior.
- Establecimiento según la afinidad por el terreno; competencia `P = cA / (cA + cB)`.

## Cómo ejecutarlo

Requiere Python 3.8+ (solo librería estándar).

```bash
python server.py
```

Se abre `http://localhost:8000` en el navegador.

## Estructura

```
ecoarbol/
├── ecosim/                  # modelo (POO, código en inglés)
│   ├── terrain.py           # TerrainType, HexGeometry, Terrain
│   ├── species.py           # Species + catálogo de 8 especies
│   ├── organism.py          # Organism (nodo del árbol)
│   ├── propagation_tree.py  # PropagationTree (árbol n-ario) y NodeType
│   └── simulation.py        # Simulation, Wind, DeathCause
├── server.py                # API JSON + servidor del frontend
└── frontend/                # dashboard en español (HTML/CSS/JS)
```

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/catalog` | Especies disponibles y límites de los rasgos |
| GET | `/api/state` | Estado completo de la simulación |
| GET | `/api/organisms/<id>` | Nodo: tipo, nivel, grado, padre, hermanos, hijos, nietos, linaje |
| POST | `/api/step` | `{count}` avanza pasos |
| POST | `/api/reset` | `{seed, species, traits}` simulación nueva |
| POST | `/api/wind` | `{direction, speed}` |
| POST | `/api/fire` | `{col, row, radius}` |
| POST | `/api/prune` | `{id}` poda el subárbol |
