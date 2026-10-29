"""Hexagonal ecosystem terrain.

Cells are pointy-top hexagons stored in "odd-r" offset coordinates (col, row):
odd rows are shifted half a cell to the right. Physical (continuous) positions use
units where the distance between the centres of two neighbouring cells is 1.
"""
import math
from enum import Enum

SQRT3 = math.sqrt(3)


class TerrainType(Enum):
    WATER = "W"
    GRASSLAND = "G"
    FOREST = "F"
    ROCK = "R"


class HexGeometry:
    """Conversions between offset cells and physical positions."""

    EVEN_ROW_NEIGHBORS = [(+1, 0), (0, -1), (-1, -1), (-1, 0), (-1, +1), (0, +1)]
    ODD_ROW_NEIGHBORS = [(+1, 0), (+1, -1), (0, -1), (-1, 0), (0, +1), (+1, +1)]

    @staticmethod
    def to_point(col, row):
        return col + 0.5 * (row & 1), row * SQRT3 / 2

    @staticmethod
    def from_point(x, y):
        """Physical point -> fractional axial coords -> cube rounding -> offset cell."""
        r = 2 * y / SQRT3
        q = x - y / SQRT3
        cube_x, cube_z = q, r
        cube_y = -cube_x - cube_z
        rx, ry, rz = round(cube_x), round(cube_y), round(cube_z)
        dx, dy, dz = abs(rx - cube_x), abs(ry - cube_y), abs(rz - cube_z)
        if dx > dy and dx > dz:
            rx = -ry - rz
        elif dy <= dz:
            rz = -rx - ry
        col = rx + (rz - (rz & 1)) // 2
        return col, rz

    @classmethod
    def neighbors(cls, col, row):
        offsets = cls.ODD_ROW_NEIGHBORS if row & 1 else cls.EVEN_ROW_NEIGHBORS
        return [(col + dc, row + dr) for dc, dr in offsets]

    @classmethod
    def distance(cls, cell_a, cell_b):
        ax, ay = cls.to_point(*cell_a)
        bx, by = cls.to_point(*cell_b)
        return math.hypot(ax - bx, ay - by)


class Terrain:
    # Share of the map covered by each terrain type, from the lowest to the highest noise value.
    PROPORTIONS = [
        (TerrainType.WATER, 0.17),
        (TerrainType.GRASSLAND, 0.38),
        (TerrainType.FOREST, 0.30),
        (TerrainType.ROCK, 0.15),
    ]
    SMOOTHING_PASSES = 5

    def __init__(self, width, height, rng):
        self.width = width
        self.height = height
        self.cells = self._generate(rng)

    def in_bounds(self, col, row):
        return 0 <= col < self.width and 0 <= row < self.height

    def type_at(self, col, row):
        return self.cells[row][col]

    def cells_of(self, terrain_type):
        return [
            (col, row)
            for row in range(self.height)
            for col in range(self.width)
            if self.cells[row][col] is terrain_type
        ]

    def to_rows(self):
        return ["".join(cell.value for cell in row) for row in self.cells]

    def _generate(self, rng):
        noise = [[rng.random() for _ in range(self.width)] for _ in range(self.height)]
        for _ in range(self.SMOOTHING_PASSES):
            noise = self._smooth(noise)

        # Thresholds by percentile, so every map keeps the same terrain proportions.
        ordered = sorted(value for row in noise for value in row)
        thresholds = []
        accumulated = 0.0
        for terrain_type, share in self.PROPORTIONS:
            accumulated += share
            index = min(int(accumulated * len(ordered)), len(ordered) - 1)
            thresholds.append((ordered[index], terrain_type))

        return [[self._classify(value, thresholds) for value in row] for row in noise]

    @staticmethod
    def _classify(value, thresholds):
        for limit, terrain_type in thresholds:
            if value <= limit:
                return terrain_type
        return thresholds[-1][1]

    def _smooth(self, noise):
        """Average every hexagon with its six neighbours."""
        smoothed = []
        for row in range(self.height):
            new_row = []
            for col in range(self.width):
                total, count = noise[row][col], 1
                for n_col, n_row in HexGeometry.neighbors(col, row):
                    if self.in_bounds(n_col, n_row):
                        total += noise[n_row][n_col]
                        count += 1
                new_row.append(total / count)
            smoothed.append(new_row)
        return smoothed
