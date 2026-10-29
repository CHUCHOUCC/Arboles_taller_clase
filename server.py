"""Minimal HTTP server: serves the frontend and exposes the simulation as a JSON API.

Usage:  python server.py   ->  open http://localhost:8000
Only the Python standard library is needed.
"""
import json
import threading
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from ecosim import DEFAULT_SPECIES_KEYS, Simulation, Species, species_catalog

HOST = "127.0.0.1"
PORT = 8000
FRONTEND_DIR = (Path(__file__).resolve().parent / "frontend").resolve()
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}
MAX_STEPS_PER_REQUEST = 100


class NotFoundError(Exception):
    pass


class SimulationController:
    """Owns the running simulation and serializes access from concurrent requests."""

    def __init__(self):
        self._lock = threading.Lock()
        self._simulation = Simulation()

    def state(self):
        with self._lock:
            return self._simulation.state()

    def catalog(self):
        return {
            "species": [species.to_dict() for species in species_catalog()],
            "defaults": DEFAULT_SPECIES_KEYS,
            "trait_limits": {trait: [low, high] for trait, (low, high, _) in Species.EDITABLE_TRAITS.items()},
            "max_fire_radius": Simulation.MAX_FIRE_RADIUS,
        }

    def step(self, body):
        count = int(body.get("count", 1))
        if not 1 <= count <= MAX_STEPS_PER_REQUEST:
            raise ValueError(f"count debe estar entre 1 y {MAX_STEPS_PER_REQUEST}")
        with self._lock:
            self._simulation.step(count)
            return self._simulation.state()

    def reset(self, body):
        seed = body.get("seed")
        seed = int(seed) if seed not in (None, "") else None
        traits = body.get("traits") or {}
        species_keys = body.get("species") or None
        with self._lock:
            previous_wind = self._simulation.wind
            simulation = Simulation(seed=seed, species_keys=species_keys, species_traits=traits)
            simulation.wind.set(previous_wind.direction_deg, previous_wind.speed)
            self._simulation = simulation
            return simulation.state()

    def wind(self, body):
        with self._lock:
            self._simulation.wind.set(body.get("direction", 0), body.get("speed", 0))
            return self._simulation.state()

    def fire(self, body):
        with self._lock:
            burned = self._simulation.start_fire(
                int(body["col"]), int(body["row"]), int(body.get("radius", 3)))
            return {**self._simulation.state(), "event": {"burned": burned}}

    def prune(self, body):
        organism_id = int(body["id"])
        with self._lock:
            result = self._simulation.prune_lineage(organism_id)
            if result is None:
                raise NotFoundError(f"El organismo #{organism_id} no existe")
            return {**self._simulation.state(), "event": result}

    def organism(self, organism_id):
        with self._lock:
            detail = self._simulation.describe(organism_id)
        if detail is None:
            raise NotFoundError(f"El organismo #{organism_id} no existe (pudo ser podado)")
        return detail


class RequestHandler(BaseHTTPRequestHandler):
    controller = None  # assigned in main()
    POST_ACTIONS = {
        "/api/step": "step",
        "/api/reset": "reset",
        "/api/wind": "wind",
        "/api/fire": "fire",
        "/api/prune": "prune",
    }

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            self._handle(self.controller.state)
        elif path == "/api/catalog":
            self._handle(self.controller.catalog)
        elif path.startswith("/api/organisms/"):
            self._handle(lambda: self.controller.organism(int(path.rsplit("/", 1)[1])))
        else:
            self._serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        action = self.POST_ACTIONS.get(path)
        if action is None:
            self._send_json({"error": "Ruta no encontrada"}, HTTPStatus.NOT_FOUND)
            return
        self._handle(lambda: getattr(self.controller, action)(self._read_json()))

    def _handle(self, action):
        try:
            self._send_json(action())
        except NotFoundError as error:
            self._send_json({"error": str(error)}, HTTPStatus.NOT_FOUND)
        except (ValueError, KeyError, TypeError) as error:
            self._send_json({"error": f"Petición inválida: {error}"}, HTTPStatus.BAD_REQUEST)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        body = json.loads(raw) if raw else {}
        if not isinstance(body, dict):
            raise ValueError("el cuerpo debe ser un objeto JSON")
        return body

    def _send_json(self, payload, status=HTTPStatus.OK):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_static(self, path):
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        file_path = (FRONTEND_DIR / relative).resolve()
        if FRONTEND_DIR not in file_path.parents or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", CONTENT_TYPES.get(file_path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        pass  # keep the console clean


def main():
    RequestHandler.controller = SimulationController()
    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    url = f"http://localhost:{PORT}"
    print(f"EcoArbol corriendo en {url}  (Ctrl+C para detener)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
