"""Species definitions: the traits that control how each species spreads."""
import math
from dataclasses import dataclass
from typing import ClassVar

from .terrain import TerrainType

W, G, F, R = TerrainType.WATER, TerrainType.GRASSLAND, TerrainType.FOREST, TerrainType.ROCK


@dataclass
class Species:
    key: str
    name: str
    scientific_name: str
    strategy: str
    color: str
    description: str
    reproduction_rate: float  # probability that an individual reproduces in one step
    max_offspring: int        # seeds released per reproduction (uniform between 1 and max)
    tree_order: int           # order of the n-ary tree: max children an organism can have
    diffusion: float          # D: dispersal diffusion coefficient [cells^2 / step]
    wind_sensitivity: float   # fraction of the wind velocity carried by the seeds
    lifespan: int             # steps an individual lives
    competitiveness: float    # weight used when two species fight for the same cell
    affinity: dict            # TerrainType -> probability that a seed establishes there

    # trait -> (min, max, type) accepted when the user edits a species
    EDITABLE_TRAITS: ClassVar[dict] = {
        "reproduction_rate": (0.0, 1.0, float),
        "max_offspring": (1, 8, int),
        "tree_order": (1, 10, int),
        "diffusion": (0.1, 10.0, float),
        "wind_sensitivity": (0.0, 1.5, float),
        "lifespan": (1, 500, int),
        "competitiveness": (0.05, 5.0, float),
    }

    def establishment_probability(self, terrain_type):
        return self.affinity.get(terrain_type, 0.0)

    def preferred_terrain(self):
        return max(self.affinity, key=self.affinity.get)

    def dispersal_sigma(self):
        """Std. deviation per axis of a Brownian displacement over one step: sqrt(2·D·dt)."""
        return math.sqrt(2 * self.diffusion)

    def effective_growth_rate(self):
        """Expected seeds released per individual per step: r·(1 + max_offspring)/2."""
        return self.reproduction_rate * (1 + self.max_offspring) / 2

    def fisher_speed(self):
        """Fisher-KPP invasion front speed v = 2·sqrt(r·D). Upper bound: ignores
        establishment failures, competition, deaths and the tree order."""
        return 2 * math.sqrt(self.effective_growth_rate() * self.diffusion)

    def update_traits(self, values):
        for trait, raw_value in values.items():
            if trait not in self.EDITABLE_TRAITS:
                raise ValueError(f"rasgo desconocido '{trait}'")
            low, high, cast = self.EDITABLE_TRAITS[trait]
            setattr(self, trait, min(max(cast(raw_value), low), high))

    def to_dict(self):
        return {
            "key": self.key,
            "name": self.name,
            "scientific_name": self.scientific_name,
            "strategy": self.strategy,
            "color": self.color,
            "description": self.description,
            "traits": {trait: getattr(self, trait) for trait in self.EDITABLE_TRAITS},
            "affinity": {terrain.name.lower(): p for terrain, p in self.affinity.items()},
            "fisher_speed": round(self.fisher_speed(), 4),
        }


def species_catalog():
    """Every species the user can choose from. Texts are shown in the (Spanish) UI."""
    return [
        Species("kikuyo", "Kikuyo", "Cenchrus clandestinus", "Colonizadora de praderas", "#ff7a1a",
                "Pasto rastrero de crecimiento rápido: se reproduce mucho, pero sus "
                "estolones se extienden cerca. Domina las praderas.",
                reproduction_rate=0.35, max_offspring=2, tree_order=5, diffusion=0.6,
                wind_sensitivity=0.1, lifespan=25, competitiveness=1.2,
                affinity={W: 0.0, G: 0.95, F: 0.35, R: 0.05}),
        Species("gorse", "Retamo espinoso", "Ulex europaeus", "Competidora longeva", "#9b4dca",
                "Arbusto espinoso que vive mucho y crece lento, pero coloniza hasta "
                "suelos rocosos y desplaza a otras plantas.",
                reproduction_rate=0.12, max_offspring=3, tree_order=6, diffusion=1.2,
                wind_sensitivity=0.2, lifespan=80, competitiveness=2.0,
                affinity={W: 0.0, G: 0.7, F: 0.45, R: 0.6}),
        Species("dandelion", "Diente de león", "Taraxacum officinale", "Viajera del viento", "#ffd21f",
                "Hierba de vida corta cuyas semillas con vilano viajan lejos con el "
                "viento, aunque compite mal por el espacio.",
                reproduction_rate=0.3, max_offspring=4, tree_order=6, diffusion=3.0,
                wind_sensitivity=1.0, lifespan=12, competitiveness=0.5,
                affinity={W: 0.0, G: 0.85, F: 0.3, R: 0.4}),
        Species("eucalyptus", "Eucalipto", "Eucalyptus globulus", "Gigante del bosque", "#00a6a6",
                "Árbol muy longevo y dominante: se reproduce poco, pero cuando ocupa "
                "un claro del bosque casi nadie lo saca.",
                reproduction_rate=0.12, max_offspring=3, tree_order=4, diffusion=1.5,
                wind_sensitivity=0.3, lifespan=150, competitiveness=2.5,
                affinity={W: 0.0, G: 0.5, F: 0.8, R: 0.3}),
        Species("bracken", "Helecho marranero", "Pteridium aquilinum", "Esporas al viento", "#2e9e3f",
                "Helecho que se propaga por esporas muy livianas: llegan lejos con el "
                "viento y prospera en bordes de bosque.",
                reproduction_rate=0.18, max_offspring=4, tree_order=5, diffusion=2.0,
                wind_sensitivity=0.7, lifespan=25, competitiveness=0.8,
                affinity={W: 0.0, G: 0.45, F: 0.7, R: 0.15}),
        Species("water_hyacinth", "Buchón de agua", "Eichhornia crassipes", "Invasora acuática", "#1e6fff",
                "Planta flotante que solo vive en el agua: se multiplica rápido y las "
                "corrientes y el viento la arrastran.",
                reproduction_rate=0.4, max_offspring=3, tree_order=5, diffusion=0.9,
                wind_sensitivity=0.5, lifespan=20, competitiveness=1.0,
                affinity={W: 0.95, G: 0.0, F: 0.0, R: 0.0}),
        Species("blackberry", "Zarzamora", "Rubus ulmifolius", "Matorral espinoso", "#d6246e",
                "Matorral cuyas semillas dispersan las aves; forma marañas espinosas "
                "en praderas y bosques.",
                reproduction_rate=0.18, max_offspring=3, tree_order=5, diffusion=1.6,
                wind_sensitivity=0.1, lifespan=60, competitiveness=1.6,
                affinity={W: 0.0, G: 0.6, F: 0.6, R: 0.25}),
        Species("lichen", "Liquen costroso", "Rhizocarpon geographicum", "Especialista de roca", "#7a8a99",
                "Liquen extremadamente lento y longevo que coloniza la roca desnuda, "
                "donde casi ninguna planta puede vivir.",
                reproduction_rate=0.15, max_offspring=2, tree_order=3, diffusion=0.5,
                wind_sensitivity=0.3, lifespan=200, competitiveness=1.3,
                affinity={W: 0.0, G: 0.05, F: 0.1, R: 0.9}),
    ]


DEFAULT_SPECIES_KEYS = ["kikuyo", "gorse", "dandelion", "water_hyacinth"]
