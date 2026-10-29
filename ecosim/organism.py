"""An individual organism. Each organism is a node of its species' propagation tree."""
from .terrain import HexGeometry


class Organism:
    def __init__(self, organism_id, species, col, row, birth_step, parent=None):
        self.id = organism_id
        self.species = species
        self.col = col
        self.row = row
        self.birth_step = birth_step
        self.parent = parent
        self.children = []
        self.alive = True
        self.death_step = None
        self.death_cause = None

    @property
    def cell(self):
        return self.col, self.row

    def position(self):
        """Physical position (neighbouring hexagons are 1 unit apart)."""
        return HexGeometry.to_point(self.col, self.row)

    def distance_to(self, other):
        return HexGeometry.distance(self.cell, other.cell)

    def can_have_more_children(self):
        return len(self.children) < self.species.tree_order

    def age(self, current_step):
        end = current_step if self.alive else self.death_step
        return end - self.birth_step

    def die(self, step, cause):
        if self.alive:
            self.alive = False
            self.death_step = step
            self.death_cause = cause

    def to_summary(self):
        return {
            "id": self.id,
            "species": self.species.key,
            "col": self.col,
            "row": self.row,
            "alive": self.alive,
        }
