"""N-ary propagation tree of one species (a genealogical tree).

The root is the founder organism. Every time an organism disperses a seed that
manages to establish, the new organism is added as its child, so the tree records
who propagated to whom.

Vocabulary used across the project:
    root    -> the founder (level 1)
    branch  -> node that is not the root and has at least one child
    leaf    -> node without children
    level   -> distance from the root + 1 (the root is on level 1)
    height  -> number of levels of the tree
    weight  -> number of nodes of the tree
    order   -> maximum number of children a node may have (species.tree_order)
    degree  -> number of children of a node; the tree degree is the largest one

Traversals are iterative so deep trees never hit Python's recursion limit.
"""
from statistics import pvariance


class NodeType:
    ROOT = "root"
    BRANCH = "branch"
    LEAF = "leaf"


class PropagationTree:
    def __init__(self, species):
        self.species = species
        self.root = None

    def is_empty(self):
        return self.root is None

    def plant_root(self, founder):
        self.root = founder

    def add_child(self, parent, child):
        if len(parent.children) >= self.species.tree_order:
            raise ValueError("the parent already reached the order of the tree")
        child.parent = parent
        parent.children.append(child)

    # ---------- traversals ----------

    def preorder(self, start=None):
        """Depth-first traversal: node, then its children from left to right."""
        start = start or self.root
        if start is None:
            return
        stack = [start]
        while stack:
            node = stack.pop()
            yield node
            stack.extend(reversed(node.children))

    def levels(self, start=None):
        """Breadth-first traversal grouped by level: levels()[0] is level 1."""
        start = start or self.root
        result = []
        current = [start] if start else []
        while current:
            result.append(current)
            current = [child for node in current for child in node.children]
        return result

    # ---------- queries about one node ----------

    def find(self, organism_id):
        for node in self.preorder():
            if node.id == organism_id:
                return node
        return None

    def level(self, node):
        level = 1
        while node.parent is not None:
            node = node.parent
            level += 1
        return level

    def node_type(self, node):
        if node.parent is None:
            return NodeType.ROOT
        return NodeType.BRANCH if node.children else NodeType.LEAF

    def siblings(self, node):
        if node.parent is None:
            return []
        return [child for child in node.parent.children if child is not node]

    def lineage(self, node):
        """Path from the root (founder) down to node."""
        path = []
        while node is not None:
            path.append(node)
            node = node.parent
        path.reverse()
        return path

    def subtree_weight(self, node):
        return sum(1 for _ in self.preorder(node))

    def subtree_height(self, node):
        return len(self.levels(node))

    # ---------- modification ----------

    def prune(self, node):
        """Detach the subtree rooted at node. Returns every removed node."""
        removed = list(self.preorder(node))
        if node.parent is None:
            self.root = None
        else:
            node.parent.children.remove(node)
            node.parent = None
        return removed

    # ---------- statistics ----------

    def statistics(self):
        """Everything the UI shows about the tree, computed in a single BFS pass."""
        stats = {
            "root": None,
            "weight": 0,
            "alive": 0,
            "height": 0,
            "order": self.species.tree_order,
            "degree": 0,
            "leaves": 0,
            "branches": 0,
            "level_sizes": [],
            "max_reach": 0.0,
            "most_prolific": None,
            "estimated_diffusion": None,
        }
        if self.root is None:
            return stats

        most_prolific = self.root
        edge_dx, edge_dy = [], []
        for level in self.levels():
            stats["level_sizes"].append(len(level))
            for node in level:
                stats["weight"] += 1
                stats["alive"] += node.alive
                stats["max_reach"] = max(stats["max_reach"], node.distance_to(self.root))
                degree = len(node.children)
                stats["degree"] = max(stats["degree"], degree)
                if degree == 0:
                    stats["leaves"] += 1
                elif node.parent is not None:
                    stats["branches"] += 1
                if degree > len(most_prolific.children):
                    most_prolific = node
                if node.parent is not None:
                    x, y = node.position()
                    px, py = node.parent.position()
                    edge_dx.append(x - px)
                    edge_dy.append(y - py)

        stats["height"] = len(stats["level_sizes"])
        stats["root"] = self.root.to_summary()
        stats["max_reach"] = round(stats["max_reach"], 3)
        stats["most_prolific"] = {"id": most_prolific.id, "children": len(most_prolific.children)}
        if len(edge_dx) >= 2:
            # Each edge is one seed jump. For Brownian motion the variance per axis is 2·D,
            # so D ≈ (var_x + var_y) / 4. Using the variance removes the wind drift.
            stats["estimated_diffusion"] = round((pvariance(edge_dx) + pvariance(edge_dy)) / 4, 4)
        return stats
