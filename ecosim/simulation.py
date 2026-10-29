"""Propagation of the selected species competing for space in one hexagonal ecosystem."""
import math
import random

from .organism import Organism
from .propagation_tree import PropagationTree
from .species import DEFAULT_SPECIES_KEYS, species_catalog
from .terrain import SQRT3, HexGeometry, Terrain


class DeathCause:
    OLD_AGE = "old_age"
    COMPETITION = "competition"
    FIRE = "fire"
    PRUNED = "pruned"


class Wind:
    MAX_SPEED = 3.0

    def __init__(self, direction_deg=0.0, speed=0.0):
        self.set(direction_deg, speed)

    def set(self, direction_deg, speed):
        self.direction_deg = float(direction_deg) % 360
        self.speed = min(max(float(speed), 0.0), self.MAX_SPEED)

    def velocity(self):
        """(vx, vy) in cells/step. 0° blows east, 90° north (screen y grows downwards)."""
        angle = math.radians(self.direction_deg)
        return self.speed * math.cos(angle), -self.speed * math.sin(angle)

    def to_dict(self):
        return {"direction": self.direction_deg, "speed": self.speed}


class Simulation:
    WIDTH = 46
    HEIGHT = 32
    MAX_FIRE_RADIUS = 8
    FOUNDER_CANDIDATES = 300

    def __init__(self, seed=None, species_keys=None, species_traits=None):
        self.seed = seed if seed is not None else random.randrange(1_000_000)
        self.rng = random.Random(self.seed)
        self.terrain = Terrain(self.WIDTH, self.HEIGHT, self.rng)
        self.species = self._select_species(species_keys or DEFAULT_SPECIES_KEYS)
        species_traits = species_traits or {}
        for species in self.species:
            species.update_traits(species_traits.get(species.key, {}))

        self.trees = {species.key: PropagationTree(species) for species in self.species}
        self.grid = [[None] * self.WIDTH for _ in range(self.HEIGHT)]  # living occupant per cell
        self.wind = Wind()
        self.step_count = 0
        self.history = []
        self._last_id = 0

        self._plant_founders()
        self._record_history()

    @staticmethod
    def _select_species(keys):
        catalog = {species.key: species for species in species_catalog()}
        unknown = [key for key in keys if key not in catalog]
        if unknown:
            raise ValueError(f"especies desconocidas: {', '.join(unknown)}")
        if not keys:
            raise ValueError("hay que elegir al menos una especie")
        wanted = set(keys)
        return [species for key, species in catalog.items() if key in wanted]

    # ---------- simulation loop ----------

    def step(self, count=1):
        for _ in range(count):
            self._advance()

    def _advance(self):
        self.step_count += 1
        living = self.living_organisms()
        self.rng.shuffle(living)  # random order so no species always acts first
        for organism in living:
            if not organism.alive:
                continue  # displaced earlier in this same step
            species = organism.species
            if organism.age(self.step_count) >= species.lifespan:
                self._kill(organism, DeathCause.OLD_AGE)
            elif organism.can_have_more_children() and self.rng.random() < species.reproduction_rate:
                for _ in range(self.rng.randint(1, species.max_offspring)):
                    if not organism.can_have_more_children():
                        break
                    self._disperse_seed(organism)
        self._record_history()

    def _disperse_seed(self, parent):
        """Advection-diffusion jump: wind drift plus a Gaussian (Brownian) displacement,
        computed in physical space and then snapped to the hexagon it lands on."""
        species = parent.species
        sigma = species.dispersal_sigma()
        wind_x, wind_y = self.wind.velocity()
        x, y = parent.position()
        x += species.wind_sensitivity * wind_x + self.rng.gauss(0, sigma)
        y += species.wind_sensitivity * wind_y + self.rng.gauss(0, sigma)
        col, row = HexGeometry.from_point(x, y)

        if (col, row) == parent.cell or not self.terrain.in_bounds(col, row):
            return None
        if self.rng.random() >= species.establishment_probability(self.terrain.type_at(col, row)):
            return None

        occupant = self.grid[row][col]
        if occupant is not None:
            if occupant.species is species:
                return None
            win_probability = species.competitiveness / (
                species.competitiveness + occupant.species.competitiveness)
            if self.rng.random() >= win_probability:
                return None
            self._kill(occupant, DeathCause.COMPETITION)

        child = Organism(self._new_id(), species, col, row, self.step_count)
        self.trees[species.key].add_child(parent, child)
        self.grid[row][col] = child
        return child

    # ---------- user events ----------

    def start_fire(self, col, row, radius):
        radius = min(max(int(radius), 1), self.MAX_FIRE_RADIUS)
        row_span = math.ceil(radius / (SQRT3 / 2))
        burned = 0
        for r in range(row - row_span, row + row_span + 1):
            for c in range(col - radius - 1, col + radius + 2):
                if not self.terrain.in_bounds(c, r):
                    continue
                if HexGeometry.distance((col, row), (c, r)) > radius:
                    continue
                occupant = self.grid[r][c]
                if occupant is not None:
                    self._kill(occupant, DeathCause.FIRE)
                    burned += 1
        return burned

    def prune_lineage(self, organism_id):
        """Remove an organism and all of its descendants from its tree."""
        tree, node = self.find(organism_id)
        if node is None:
            return None
        removed = tree.prune(node)
        alive_removed = sum(organism.alive for organism in removed)
        for organism in removed:
            self._kill(organism, DeathCause.PRUNED)
        return {"removed": len(removed), "alive_removed": alive_removed}

    # ---------- queries ----------

    def living_organisms(self):
        return [organism for row in self.grid for organism in row if organism is not None]

    def find(self, organism_id):
        for tree in self.trees.values():
            node = tree.find(organism_id)
            if node is not None:
                return tree, node
        return None, None

    def describe(self, organism_id):
        tree, node = self.find(organism_id)
        if node is None:
            return None

        def child_summary(child, with_grandchildren):
            summary = {
                **child.to_summary(),
                "node_type": tree.node_type(child),
                "degree": len(child.children),
                "subtree_weight": tree.subtree_weight(child),
            }
            if with_grandchildren:
                summary["children"] = [
                    {**g.to_summary(), "node_type": tree.node_type(g)} for g in child.children
                ]
            return summary

        siblings = tree.siblings(node)
        return {
            **node.to_summary(),
            "node_type": tree.node_type(node),
            "level": tree.level(node),
            "degree": len(node.children),
            "order": node.species.tree_order,
            "birth_step": node.birth_step,
            "death_step": node.death_step,
            "death_cause": node.death_cause,
            "age": node.age(self.step_count),
            "subtree_weight": tree.subtree_weight(node),
            "subtree_height": tree.subtree_height(node),
            "parent": ({**node.parent.to_summary(), "node_type": tree.node_type(node.parent)}
                       if node.parent else None),
            "siblings": [{**s.to_summary(), "node_type": tree.node_type(s)} for s in siblings],
            "lineage": [ancestor.to_summary() for ancestor in tree.lineage(node)],
            "children": [child_summary(child, with_grandchildren=True) for child in node.children],
        }

    def state(self):
        return {
            "seed": self.seed,
            "step": self.step_count,
            "width": self.WIDTH,
            "height": self.HEIGHT,
            "terrain": self.terrain.to_rows(),
            "wind": self.wind.to_dict(),
            "organisms": [[o.id, o.species.key, o.col, o.row] for o in self.living_organisms()],
            "species": [
                {**species.to_dict(), "stats": self.trees[species.key].statistics()}
                for species in self.species
            ],
            "history": self.history,
        }

    # ---------- helpers ----------

    def _plant_founders(self):
        """One founder (tree root) per species, spread out over the map: each founder
        goes to a cell of its preferred terrain as far as possible from the others."""
        placed = []
        for species in self.species:
            candidates = self.terrain.cells_of(species.preferred_terrain())
            candidates = [cell for cell in candidates if self.grid[cell[1]][cell[0]] is None]
            if len(candidates) > self.FOUNDER_CANDIDATES:
                candidates = self.rng.sample(candidates, self.FOUNDER_CANDIDATES)
            if placed:
                col, row = max(candidates, key=lambda cell: min(
                    HexGeometry.distance(cell, other) for other in placed))
            else:
                col, row = self.rng.choice(candidates)
            founder = Organism(self._new_id(), species, col, row, birth_step=0)
            self.trees[species.key].plant_root(founder)
            self.grid[row][col] = founder
            placed.append((col, row))

    def _kill(self, organism, cause):
        organism.die(self.step_count, cause)
        if self.grid[organism.row][organism.col] is organism:
            self.grid[organism.row][organism.col] = None

    def _new_id(self):
        self._last_id += 1
        return self._last_id

    def _record_history(self):
        counts = {species.key: 0 for species in self.species}
        for organism in self.living_organisms():
            counts[organism.species.key] += 1
        self.history.append({"step": self.step_count, "counts": counts})
