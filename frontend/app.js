"use strict";

/* =================================================================
   Labels and descriptions (the UI is in Spanish, the code in English)
   ================================================================= */
const SQRT3 = Math.sqrt(3);

const TERRAIN = {
  W: { label: "Agua", base: "#3d9fe3" },
  G: { label: "Pradera", base: "#8fd04e" },
  F: { label: "Bosque", base: "#55ae48" },
  R: { label: "Roca", base: "#b39a84" },
};
const AFFINITY_ORDER = ["water", "grassland", "forest", "rock"];
const AFFINITY_LABELS = { water: "Agua", grassland: "Pradera", forest: "Bosque", rock: "Roca" };
const DEATH_CAUSES = {
  old_age: "vejez",
  competition: "desplazado por otra especie",
  fire: "incendio",
  pruned: "poda de linaje",
};
const NODE_TYPES = {
  root: { label: "Raíz", color: "#ffc928" },
  branch: { label: "Rama", color: "#a9d4ff" },
  leaf: { label: "Hoja", color: "#8ee06a" },
};
const TRAIT_FIELDS = [
  { key: "reproduction_rate", label: "Tasa de reproducción", step: 0.01,
    desc: "Probabilidad de que un organismo suelte semillas en cada paso.", format: (v) => `${Math.round(v * 100)} %` },
  { key: "max_offspring", label: "Semillas por reproducción", step: 1,
    desc: "Cuántas semillas suelta como máximo cada vez que se reproduce.", format: (v) => `${v}` },
  { key: "tree_order", label: "Orden del árbol", step: 1,
    desc: "Máximo de hijos que puede tener un organismo en toda su vida (árbol de orden n).", format: (v) => `${v}` },
  { key: "diffusion", label: "Difusión D", step: 0.1,
    desc: "Qué tan lejos caen las semillas por puro azar (celdas²/paso).", format: (v) => Number(v).toFixed(1) },
  { key: "wind_sensitivity", label: "Sensibilidad al viento", step: 0.05,
    desc: "Qué tanto arrastra el viento a las semillas (0 = nada, 1 = todo).", format: (v) => Number(v).toFixed(2) },
  { key: "lifespan", label: "Esperanza de vida", step: 1,
    desc: "Pasos que vive un organismo antes de morir de vejez.", format: (v) => `${v} pasos` },
  { key: "competitiveness", label: "Competitividad", step: 0.05,
    desc: "Fuerza para quitarle una celda ocupada a otra especie.", format: (v) => Number(v).toFixed(2) },
];
const TOOL_DESCRIPTIONS = {
  inspect: "Inspeccionar: haz clic en una esfera para ver ese organismo en su árbol. En el mapa se marca su linaje " +
    "(el camino desde la raíz) y las líneas hacia sus hijos.",
  fire: "Incendio: haz clic en el mapa para quemar un círculo del radio elegido en el panel Incendio. Los organismos " +
    "mueren pero quedan en su árbol como nodos históricos.",
};
const COMPASS_NAMES = ["Este", "Noreste", "Norte", "Noroeste", "Oeste", "Suroeste", "Sur", "Sureste"];
const GUIDE = [
  { icon: "▶", title: "Reproducir, +1 y +10", where: "Barra superior",
    text: "Avanzan el tiempo de la simulación. Reproducir avanza solo hasta que pulses Pausar; al lado eliges la velocidad." },
  { icon: "#", title: "Buscar organismo", where: "Barra superior",
    text: "Escribe el número de un organismo y pulsa Buscar: se abre en el explorador de nodos de la vista Árbol." },
  { icon: "◎", title: "Inspeccionar en el mapa", where: "Simulación › Mapa",
    text: "Haz clic en una esfera del mapa: se marca su linaje desde la raíz, sus hijos, y se muestra su información." },
  { icon: "✹", title: "Incendio", where: "Simulación › Mapa y panel Incendio",
    text: "Elige la herramienta Incendio y haz clic donde quieras quemar. El radio se ajusta en el panel Incendio." },
  { icon: "≋", title: "Viento", where: "Simulación › Viento",
    text: "Cambia hacia dónde sopla y con qué fuerza. Arrastra las semillas: es la parte de advección del modelo físico." },
  { icon: "◐", title: "Mostrar u ocultar especies", where: "Simulación › Especies en el mapa",
    text: "Los interruptores solo cambian lo que ves en el mapa, para seguir mejor a una especie. No detienen la simulación." },
  { icon: "✚", title: "Elegir especies", where: "Especies",
    text: "Activa de 1 a 8 especies y pulsa Aplicar y reiniciar. Cada especie empieza con un fundador, que es la raíz de su árbol." },
  { icon: "⚙", title: "Ajustar rasgos", where: "Especies › Ajustar rasgos",
    text: "Cambia la reproducción, el orden del árbol, la difusión, la vida o la competitividad de una especie antes de reiniciar." },
  { icon: "⌗", title: "Semilla del mapa", where: "Especies",
    text: "El mismo número genera el mismo mapa. Sirve para repetir un experimento cambiando solo un rasgo." },
  { icon: "⋔", title: "Árbol de cada especie", where: "Árbol",
    text: "Muestra el peso, la altura, el orden, el grado, las hojas, las ramas y cuántos nodos hay en cada nivel." },
  { icon: "◇", title: "Explorador de nodos", where: "Árbol",
    text: "Dibuja el padre, los hermanos, los hijos y los nietos de un organismo. Haz clic en cualquier nodo para recorrer el árbol." },
  { icon: "✂", title: "Podar linaje", where: "Árbol › Explorador de nodos",
    text: "Elimina un organismo y todo su subárbol, como si se erradicara ese linaje en campo." },
  { icon: "▤", title: "Estadísticas", where: "Estadísticas",
    text: "Gráfica de población y tabla que compara las especies: medidas del árbol, alcance, difusión y frente de invasión." },
];

/* =================================================================
   Small helpers
   ================================================================= */
function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === "class") node.className = value;
    else if (name === "dataset") Object.assign(node.dataset, value);
    else if (name === "style" && typeof value === "object") {
      for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
    } else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function orb(color) {
  return el("span", { class: "orb", style: { "--c": color } });
}

function formatNumber(value, digits = 2) {
  return value === null || value === undefined ? "—" : Number(value).toFixed(digits);
}

function compassName(degrees) {
  return COMPASS_NAMES[Math.round(degrees / 45) % 8];
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.65;
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/* Deterministic pseudo-random number in [0, 1) for a cell, so the terrain art never flickers. */
function cellRandom(col, row, index) {
  let h = Math.imul(col + 1, 374761393) ^ Math.imul(row + 7, 668265263) ^ Math.imul(index + 13, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* =================================================================
   API
   ================================================================= */
class ApiClient {
  async request(method, path, body) {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `Error ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  getCatalog() { return this.request("GET", "/api/catalog"); }
  getState() { return this.request("GET", "/api/state"); }
  step(count) { return this.request("POST", "/api/step", { count }); }
  reset(seed, species, traits) { return this.request("POST", "/api/reset", { seed, species, traits }); }
  setWind(direction, speed) { return this.request("POST", "/api/wind", { direction, speed }); }
  fire(col, row, radius) { return this.request("POST", "/api/fire", { col, row, radius }); }
  prune(id) { return this.request("POST", "/api/prune", { id }); }
  getOrganism(id) { return this.request("GET", `/api/organisms/${id}`); }
}

/* =================================================================
   Hexagonal geometry (same "odd-r" layout as the Python backend)
   ================================================================= */
class HexLayout {
  constructor(cols, rows, radius = 14, padding = 8) {
    this.cols = cols;
    this.rows = rows;
    this.R = radius;
    this.pad = padding;
    this.w = SQRT3 * radius; // pixels between neighbouring centres = pixels per physical unit
    this.width = padding * 2 + this.w * (cols + 0.5);
    this.height = padding * 2 + 2 * radius + 1.5 * radius * (rows - 1);
  }

  center(col, row) {
    return [this.pad + this.w / 2 + this.w * (col + 0.5 * (row & 1)), this.pad + this.R + 1.5 * this.R * row];
  }

  static fromPoint(x, y) {
    const r = (2 * y) / SQRT3;
    const q = x - y / SQRT3;
    const cx = q;
    const cz = r;
    const cy = -cx - cz;
    let rx = Math.round(cx);
    const ry = Math.round(cy);
    let rz = Math.round(cz);
    const dx = Math.abs(rx - cx);
    const dy = Math.abs(ry - cy);
    const dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy <= dz) rz = -rx - ry;
    return [rx + (rz - (rz & 1)) / 2, rz];
  }

  cellAtPixel(px, py) {
    const [col, row] = HexLayout.fromPoint((px - this.pad - this.w / 2) / this.w, (py - this.pad - this.R) / this.w);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return { col, row };
  }

  hexPath(ctx, cx, cy, radius = this.R) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

/* Paints the pixel-art terrain once into an offscreen canvas. */
class TerrainPainter {
  static paint(layout, rows, scale) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(layout.width * scale);
    canvas.height = Math.ceil(layout.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    rows.forEach((line, row) => {
      [...line].forEach((code, col) => {
        const [cx, cy] = layout.center(col, row);
        const variation = (cellRandom(col, row, 0) - 0.5) * 0.12;
        layout.hexPath(ctx, cx, cy, layout.R + 0.4);
        ctx.fillStyle = shade(TERRAIN[code].base, variation);
        ctx.fill();
        ctx.save();
        layout.hexPath(ctx, cx, cy, layout.R);
        ctx.clip();
        TerrainPainter[`draw${code}`](ctx, cx, cy, layout.R, col, row);
        ctx.restore();
        layout.hexPath(ctx, cx, cy, layout.R);
        ctx.strokeStyle = "rgba(10, 50, 30, 0.28)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    });
    return canvas;
  }

  static drawW(ctx, cx, cy, R, col, row) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    for (let i = 0; i < 3; i++) {
      const x = cx + (cellRandom(col, row, i + 1) - 0.5) * R * 1.1;
      const y = cy + (cellRandom(col, row, i + 4) - 0.5) * R * 1.1;
      ctx.fillRect(x - 3, y, 2, 1.5);
      ctx.fillRect(x - 1, y - 1.5, 2, 1.5);
      ctx.fillRect(x + 1, y, 2, 1.5);
    }
    if (cellRandom(col, row, 9) < 0.14) {
      ctx.fillStyle = "rgba(235, 248, 255, 0.85)";
      for (const [dx, dy, r] of [[-2, 0, 3], [2.5, -1.5, 2.4], [1, 2.5, 2]]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  static drawG(ctx, cx, cy, R, col, row) {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(cx + (cellRandom(col, row, i + 1) - 0.5) * R * 1.3);
      const y = Math.round(cy + (cellRandom(col, row, i + 7) - 0.5) * R * 1.3);
      ctx.fillStyle = "#5fa834";
      ctx.fillRect(x, y, 1.5, 3);
      ctx.fillRect(x + 2, y - 1.5, 1.5, 4.5);
      ctx.fillRect(x + 4, y, 1.5, 3);
    }
    if (cellRandom(col, row, 20) < 0.3) {
      ctx.fillStyle = cellRandom(col, row, 21) < 0.5 ? "#ffe45c" : "#ffffff";
      ctx.fillRect(cx + (cellRandom(col, row, 22) - 0.5) * R, cy + (cellRandom(col, row, 23) - 0.5) * R, 2, 2);
    }
  }

  static drawF(ctx, cx, cy, R, col, row) {
    const spots = [[-0.42, 0.05], [0.38, -0.05], [0, -0.45], [0.02, 0.48]];
    spots.forEach(([fx, fy], i) => {
      if (i === 3 && cellRandom(col, row, 30) < 0.5) return;
      const x = Math.round(cx + fx * R + (cellRandom(col, row, i + 1) - 0.5) * 3);
      const y = Math.round(cy + fy * R + (cellRandom(col, row, i + 5) - 0.5) * 3);
      ctx.fillStyle = "#6b4423";
      ctx.fillRect(x - 1, y + 2, 2, 3);
      ctx.fillStyle = "#2b7a34";
      ctx.fillRect(x - 4, y - 2, 8, 5);
      ctx.fillRect(x - 3, y - 4, 6, 2);
      ctx.fillRect(x - 2, y - 5.5, 4, 1.5);
      ctx.fillStyle = "#4bb04a";
      ctx.fillRect(x - 3, y - 3, 3, 2);
    });
  }

  static drawR(ctx, cx, cy, R, col, row) {
    const peaks = cellRandom(col, row, 40) < 0.45
      ? [[cx - R * 0.3, R * 0.95], [cx + R * 0.38, R * 0.7]]
      : [[cx + (cellRandom(col, row, 41) - 0.5) * 3, R * 1.15]];
    for (const [px, height] of peaks) {
      const top = cy + R * 0.55 - height;
      const steps = Math.round(height / 2);
      for (let k = 0; k < steps; k++) {
        const y = top + k * 2;
        const half = (k + 1) * 1.55;
        const snow = k < Math.max(2, steps * 0.25);
        ctx.fillStyle = snow ? "#f4f8ff" : "#8f725b";
        ctx.fillRect(px - half, y, half, 2);
        ctx.fillStyle = snow ? "#cfdcec" : "#6b513f";
        ctx.fillRect(px, y, half, 2);
      }
    }
  }
}

/* =================================================================
   Map view
   ================================================================= */
class MapView {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.handlers = handlers;
    this.scale = 2;
    this.layout = null;
    this.state = null;
    this.terrainKey = "";
    this.terrainLayer = null;
    this.sprites = new Map();
    this.hidden = new Set();
    this.detail = null;
    this.hoverCell = null;
    this.tool = "inspect";
    this.fireRadius = 3;

    canvas.addEventListener("click", (event) => {
      const cell = this.cellAt(event);
      if (cell) this.handlers.onClick(cell);
    });
    canvas.addEventListener("mousemove", (event) => {
      this.hoverCell = this.cellAt(event);
      this.handlers.onHover(this.hoverCell);
      this.draw();
    });
    canvas.addEventListener("mouseleave", () => {
      this.hoverCell = null;
      this.handlers.onHover(null);
      this.draw();
    });
  }

  cellAt(event) {
    if (!this.layout) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * this.layout.width;
    const py = ((event.clientY - rect.top) / rect.height) * this.layout.height;
    return this.layout.cellAtPixel(px, py);
  }

  setState(state) {
    this.state = state;
    if (!this.layout || this.layout.cols !== state.width || this.layout.rows !== state.height) {
      this.layout = new HexLayout(state.width, state.height);
      this.canvas.width = Math.ceil(this.layout.width * this.scale);
      this.canvas.height = Math.ceil(this.layout.height * this.scale);
      this.terrainKey = "";
    }
    const key = state.terrain.join("");
    if (key !== this.terrainKey) {
      this.terrainKey = key;
      this.terrainLayer = TerrainPainter.paint(this.layout, state.terrain, this.scale);
    }
    for (const species of state.species) {
      if (!this.sprites.has(species.color)) this.sprites.set(species.color, this.makeSprite(species.color));
    }
    this.draw();
  }

  makeSprite(color) {
    const radius = this.layout.R * 0.5;
    const size = Math.ceil(radius * 2 + 4) * this.scale;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.scale(this.scale, this.scale);
    const c = size / this.scale / 2;
    const gradient = ctx.createRadialGradient(c - radius * 0.35, c - radius * 0.4, radius * 0.1, c, c, radius);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.28, shade(color, 0.35));
    gradient.addColorStop(0.72, color);
    gradient.addColorStop(1, shade(color, -0.35));
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 30, 60, 0.55)";
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(c - radius * 0.15, c - radius * 0.5, radius * 0.5, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fill();
    return canvas;
  }

  setHidden(hidden) { this.hidden = hidden; this.draw(); }
  setDetail(detail) { this.detail = detail; this.draw(); }
  setTool(tool, fireRadius) { this.tool = tool; this.fireRadius = fireRadius; this.draw(); }

  draw() {
    if (!this.state || !this.layout) return;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.terrainLayer, 0, 0);
    ctx.scale(this.scale, this.scale);

    const colors = Object.fromEntries(this.state.species.map((s) => [s.key, s.color]));
    for (const [, speciesKey, col, row] of this.state.organisms) {
      if (this.hidden.has(speciesKey)) continue;
      const sprite = this.sprites.get(colors[speciesKey]);
      const [cx, cy] = this.layout.center(col, row);
      const size = sprite.width / this.scale;
      ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size);
    }
    this.drawFounders();
    this.drawDetail();
    this.drawFirePreview();
  }

  drawFounders() {
    const ctx = this.ctx;
    for (const species of this.state.species) {
      const root = species.stats.root;
      if (!root || this.hidden.has(species.key)) continue;
      const [cx, cy] = this.layout.center(root.col, root.row);
      this.layout.hexPath(ctx, cx, cy, this.layout.R - 1);
      ctx.setLineDash(root.alive ? [] : [3, 2]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = species.color;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawDetail() {
    const detail = this.detail;
    if (!detail) return;
    const ctx = this.ctx;
    const points = detail.lineage.map((n) => this.layout.center(n.col, n.row));
    ctx.lineJoin = "round";
    for (const [width, color, dash] of [[4, "rgba(255,255,255,0.9)", []], [2, "#0b3550", [5, 4]]]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const [x, y] of points) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "#0b3550";
      ctx.fill();
    }

    const [sx, sy] = this.layout.center(detail.col, detail.row);
    for (const child of detail.children) {
      const [cx, cy] = this.layout.center(child.col, child.row);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, this.layout.R * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx, sy, this.layout.R * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0a78c6";
    ctx.stroke();
  }

  drawFirePreview() {
    if (this.tool !== "fire" || !this.hoverCell) return;
    const ctx = this.ctx;
    const [cx, cy] = this.layout.center(this.hoverCell.col, this.hoverCell.row);
    ctx.beginPath();
    ctx.arc(cx, cy, (this.fireRadius + 0.5) * this.layout.w, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 90, 40, 0.22)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(226, 70, 47, 0.95)";
    ctx.stroke();
  }
}

/* =================================================================
   Small canvas widgets
   ================================================================= */
function prepareCanvas(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function niceCeil(value) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitude >= value) return factor * magnitude;
  }
  return 10 * magnitude;
}

class Compass {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  draw(direction, speed, maxSpeed = 3) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2 - 6;
    ctx.clearRect(0, 0, width, height);

    const face = ctx.createRadialGradient(cx - 12, cy - 16, 4, cx, cy, radius);
    face.addColorStop(0, "#ffffff");
    face.addColorStop(0.6, "#dff3ff");
    face.addColorStop(1, "#9fd8f7");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = face;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#3f6680";
    ctx.font = "bold 10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", cx, 14);
    ctx.fillText("S", cx, height - 14);
    ctx.fillText("E", width - 14, cy);
    ctx.fillText("O", 14, cy);

    if (speed <= 0) {
      ctx.fillText("calma", cx, cy);
      return;
    }
    const angle = (direction * Math.PI) / 180;
    const length = radius * (0.3 + 0.5 * (speed / maxSpeed));
    const tipX = cx + Math.cos(angle) * length;
    const tipY = cy - Math.sin(angle) * length;
    ctx.strokeStyle = "#0a78c6";
    ctx.fillStyle = "#0a78c6";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * length * 0.4, cy + Math.sin(angle) * length * 0.4);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    const head = 9;
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(angle) * 3, tipY - Math.sin(angle) * 3);
    ctx.lineTo(tipX - head * Math.cos(angle - 0.5), tipY + head * Math.sin(angle - 0.5));
    ctx.lineTo(tipX - head * Math.cos(angle + 0.5), tipY + head * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
  }
}

class DonutChart {
  constructor(canvas, legend) {
    this.canvas = canvas;
    this.legend = legend;
  }

  update(state, hidden) {
    const total = state.width * state.height;
    const counts = {};
    for (const [, key] of state.organisms) counts[key] = (counts[key] || 0) + 1;
    const occupied = state.organisms.length;
    const prepared = prepareCanvas(this.canvas);
    if (prepared) {
      const { ctx, width, height } = prepared;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2 - 12;
      ctx.lineWidth = 16;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(10, 120, 198, 0.12)";
      ctx.stroke();
      let start = -Math.PI / 2;
      for (const species of state.species) {
        const share = (counts[species.key] || 0) / total;
        if (!share) continue;
        const end = start + share * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, end);
        ctx.strokeStyle = species.color;
        ctx.globalAlpha = hidden.has(species.key) ? 0.3 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        start = end;
      }
      ctx.fillStyle = "#0b3550";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 30px Segoe UI, sans-serif";
      ctx.fillText(`${Math.round((occupied / total) * 100)}%`, cx, cy - 6);
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillStyle = "#5d8199";
      ctx.fillText("ocupado", cx, cy + 18);
    }
    this.legend.replaceChildren(
      ...state.species.map((s) => el("span", {}, el("i", { class: "dot", style: { background: s.color } }), s.name,
        el("b", {}, `${(((counts[s.key] || 0) / total) * 100).toFixed(1)}%`))),
      el("span", {}, el("i", { class: "dot", style: { background: "rgba(10,120,198,0.15)" } }), "Libre",
        el("b", {}, `${(((total - occupied) / total) * 100).toFixed(1)}%`)));
  }
}

class LineChart {
  constructor(canvas, legend = null, { compact = false } = {}) {
    this.canvas = canvas;
    this.legend = legend;
    this.compact = compact;
    this.history = [];
    this.species = [];
  }

  update(history, species) {
    this.history = history;
    this.species = species;
    if (this.legend) {
      this.legend.replaceChildren(...species.map((s) =>
        el("span", {}, el("i", { class: "dot", style: { background: s.color } }), s.name)));
    }
    this.draw();
  }

  draw() {
    const prepared = prepareCanvas(this.canvas);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    const pad = this.compact ? { left: 30, right: 6, top: 6, bottom: 16 } : { left: 48, right: 14, top: 12, bottom: 32 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const lastStep = this.history.length ? this.history[this.history.length - 1].step : 0;
    const maxStep = Math.max(10, lastStep);
    let maxValue = 10;
    for (const entry of this.history) {
      for (const s of this.species) maxValue = Math.max(maxValue, entry.counts[s.key] || 0);
    }
    maxValue = niceCeil(maxValue);
    const xOf = (step) => pad.left + (step / maxStep) * plotWidth;
    const yOf = (value) => pad.top + plotHeight - (value / maxValue) * plotHeight;

    ctx.font = `${this.compact ? 10 : 11}px Consolas, monospace`;
    ctx.fillStyle = "#5d8199";
    ctx.strokeStyle = "rgba(10, 120, 198, 0.12)";
    ctx.lineWidth = 1;
    const ticks = this.compact ? 2 : 4;
    for (let i = 0; i <= ticks; i++) {
      const value = (maxValue * i) / ticks;
      const y = Math.round(yOf(value)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(Math.round(value), pad.left - 6, y + 4);
    }
    ctx.textAlign = "center";
    const xTicks = this.compact ? 2 : 5;
    for (let i = 0; i <= xTicks; i++) {
      const step = Math.round((maxStep * i) / xTicks);
      ctx.fillText(step, xOf(step), height - (this.compact ? 3 : 16));
    }
    if (!this.compact) ctx.fillText("paso", pad.left + plotWidth / 2, height - 2);

    for (const s of this.species) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = this.compact ? 1.8 : 2.4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      this.history.forEach((entry, i) => {
        const x = xOf(entry.step);
        const y = yOf(entry.counts[s.key] || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
}

class LevelsChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.sizes = [];
    this.color = "#13aee8";
  }

  update(sizes, color) {
    this.sizes = sizes;
    this.color = color;
    this.draw();
  }

  draw() {
    const prepared = prepareCanvas(this.canvas);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    const pad = { left: 44, right: 10, top: 10, bottom: 30 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxValue = niceCeil(Math.max(1, ...this.sizes));
    const n = Math.max(1, this.sizes.length);
    const barWidth = plotWidth / n;

    ctx.font = "11px Consolas, monospace";
    ctx.fillStyle = "#5d8199";
    ctx.strokeStyle = "rgba(10, 120, 198, 0.12)";
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue * i) / 4;
      const y = Math.round(pad.top + plotHeight - (value / maxValue) * plotHeight) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(Math.round(value), pad.left - 6, y + 4);
    }
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotHeight);
    gradient.addColorStop(0, shade(this.color, 0.45));
    gradient.addColorStop(1, this.color);
    this.sizes.forEach((size, i) => {
      const h = (size / maxValue) * plotHeight;
      const x = pad.left + i * barWidth;
      ctx.fillStyle = gradient;
      ctx.fillRect(x + Math.min(1, barWidth * 0.15), pad.top + plotHeight - h, Math.max(1, barWidth - Math.min(2, barWidth * 0.3)), h);
    });
    ctx.fillStyle = "#5d8199";
    ctx.textAlign = "center";
    const every = Math.max(1, Math.ceil(n / 10));
    for (let i = 0; i < n; i += every) {
      ctx.fillText(i + 1, pad.left + (i + 0.5) * barWidth, height - 16);
    }
    ctx.fillText("nivel", pad.left + plotWidth / 2, height - 2);
  }
}

/* =================================================================
   Species catalog (choose which species to simulate and tune them)
   ================================================================= */
class SpeciesCatalogView {
  constructor(container, catalog, handlers) {
    this.container = container;
    this.catalog = catalog;
    this.handlers = handlers;
    this.selection = new Set();
    this.traits = {};
    this.cards = new Map();
    this.resetTraits();
  }

  resetTraits(key = null) {
    for (const species of this.catalog.species) {
      if (key === null || key === species.key) this.traits[species.key] = { ...species.traits };
    }
  }

  setFromState(state) {
    this.selection = new Set(state.species.map((s) => s.key));
    for (const species of state.species) this.traits[species.key] = { ...species.traits };
    this.render();
  }

  snapshot() {
    const keys = [...this.selection].sort();
    return JSON.stringify(keys.map((k) => [k, this.traits[k]]));
  }

  render() {
    this.cards.clear();
    this.container.replaceChildren(...this.catalog.species.map((s) => this.buildCard(s)));
    if (this.lastState) this.updateStats(this.lastState);
  }

  buildCard(species) {
    const selected = this.selection.has(species.key);
    const toggle = el("input", {
      type: "checkbox",
      checked: selected,
      "aria-label": `Simular ${species.name}`,
      onchange: (event) => this.toggle(species.key, event.target.checked, event.target),
    });

    const sliders = TRAIT_FIELDS.map((field) => {
      const [min, max] = this.catalog.trait_limits[field.key];
      const value = el("span", { class: "value" }, field.format(this.traits[species.key][field.key]));
      const input = el("input", {
        type: "range", min, max, step: field.step, value: this.traits[species.key][field.key],
        oninput: (event) => {
          this.traits[species.key][field.key] = Number(event.target.value);
          value.textContent = field.format(event.target.value);
          this.handlers.onChange();
        },
      });
      return el("label", { class: "trait" }, field.label, value, el("span", { class: "trait-desc" }, field.desc), input);
    });

    const affinity = AFFINITY_ORDER.map((terrain) => {
      const p = species.affinity[terrain];
      return el("div", { class: "affinity-row" },
        el("span", {}, AFFINITY_LABELS[terrain]),
        el("div", { class: "bar" }, el("div", { class: "bar-fill", style: { width: `${p * 100}%` } })),
        el("span", { class: "num" }, `${Math.round(p * 100)}%`));
    });

    const stats = el("div", { class: "mini-stats" });
    const card = el("article", { class: `glass card species-card${selected ? "" : " unselected"}`, style: { "--c": species.color } },
      el("div", { class: "species-head" },
        orb(species.color),
        el("div", {}, el("h3", {}, species.name), el("p", { class: "sci" }, species.scientific_name)),
        el("label", { class: "include", title: "Incluir esta especie en la próxima simulación" },
          el("span", { class: "switch" }, toggle, el("span")), "Simular")),
      el("div", {}, el("span", { class: "tag" }, species.strategy)),
      el("p", {}, species.description),
      el("p", { class: "desc" }, "Afinidad por terreno: probabilidad de que una semilla se establezca en cada tipo de suelo."),
      affinity,
      stats,
      el("details", { class: "traits-box" },
        el("summary", {}, "Ajustar rasgos"),
        sliders,
        el("button", {
          class: "btn small", style: { "margin-top": "10px" },
          onclick: () => { this.resetTraits(species.key); this.render(); this.handlers.onChange(); },
        }, "Valores originales")));
    this.cards.set(species.key, { card, stats });
    return card;
  }

  toggle(key, checked, input) {
    if (!checked && this.selection.size === 1) {
      input.checked = true;
      this.handlers.onError("Debe quedar al menos una especie seleccionada.");
      return;
    }
    if (checked) this.selection.add(key);
    else this.selection.delete(key);
    this.cards.get(key).card.classList.toggle("unselected", !checked);
    this.handlers.onChange();
  }

  selectAll() {
    this.catalog.species.forEach((s) => this.selection.add(s.key));
    this.render();
    this.handlers.onChange();
  }

  restoreDefaults() {
    this.selection = new Set(this.catalog.defaults);
    this.resetTraits();
    this.render();
    this.handlers.onChange();
  }

  updateStats(state) {
    this.lastState = state;
    const active = Object.fromEntries(state.species.map((s) => [s.key, s.stats]));
    for (const [key, { stats }] of this.cards) {
      const s = active[key];
      stats.replaceChildren(...(s
        ? [el("span", {}, "Vivos ", el("b", {}, s.alive)), el("span", {}, "Peso ", el("b", {}, s.weight)),
          el("span", {}, "Altura ", el("b", {}, s.height))]
        : [el("span", {}, "No está en la simulación actual.")]));
    }
  }
}

/* =================================================================
   Tree view: per-species metrics and the node explorer
   ================================================================= */
class NodeExplorer {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this.clear();
  }

  clear() {
    this.container.replaceChildren(el("div", { class: "placeholder" },
      el("p", {}, el("strong", {}, "Todavía no has elegido un organismo.")),
      el("p", {}, "Haz clic en una esfera del mapa, busca un número en la barra superior o empieza por la raíz de una especie."),
      el("button", { class: "btn", onclick: () => this.handlers.onGoto("sim") }, "Ir al mapa"),
      el("button", { class: "btn primary", onclick: () => this.handlers.onSelectRoot() }, "Ver la raíz de la especie elegida")));
  }

  chip(node, currentId) {
    const classes = ["chip"];
    if (!node.alive) classes.push("dead");
    if (node.id === currentId) classes.push("current");
    return el("button", { class: classes.join(" "), onclick: () => this.handlers.onSelect(node.id) }, `#${node.id}`);
  }

  render(detail, species) {
    const type = NODE_TYPES[detail.node_type];
    const facts = [
      ["Tipo de nodo", type.label, "Raíz: fundador. Rama: tiene hijos y no es raíz. Hoja: no tiene hijos."],
      ["Nivel", detail.level, "Distancia a la raíz contando desde 1: es la generación del organismo."],
      ["Grado", `${detail.degree} de ${detail.order}`, "Hijos que tiene este nodo, frente al orden (máximo permitido) de la especie."],
      ["Hermanos", detail.siblings.length, "Otros hijos del mismo padre."],
      ["Padre", detail.parent ? `#${detail.parent.id}` : "— (es la raíz)", "Organismo del que vino la semilla."],
      ["Peso del subárbol", detail.subtree_weight, "Este nodo más todos sus descendientes."],
      ["Altura del subárbol", detail.subtree_height, "Generaciones que descienden de este organismo, contándolo a él."],
      ["Estado", detail.alive ? "Vivo" : `Murió en el paso ${detail.death_step}`, "Los muertos siguen en el árbol como historia."],
      ["Nació en el paso", detail.birth_step, ""],
      ["Edad", `${detail.age} pasos`, ""],
      ["Posición", `(${detail.col}, ${detail.row})`, "Columna y fila del hexágono."],
    ];

    const lineage = this.lineageChips(detail);
    const siblings = detail.siblings.length
      ? detail.siblings.map((s) => this.chip(s, detail.id))
      : [el("span", { class: "desc" }, detail.parent ? "No tiene hermanos." : "La raíz no tiene hermanos.")];
    const children = detail.children.length
      ? detail.children.map((c) => {
          const chip = this.chip(c, detail.id);
          chip.textContent = `#${c.id} · ${plural(c.subtree_weight, "nodo", "nodos")}`;
          chip.title = `${NODE_TYPES[c.node_type].label}, grado ${c.degree}`;
          return chip;
        })
      : [el("span", { class: "desc" }, "Es una hoja: no tiene descendientes.")];

    this.container.replaceChildren(
      el("div", { class: "node-head" },
        orb(species.color),
        el("h3", {}, `Organismo #${detail.id}`),
        el("span", { class: `pill ${detail.node_type}` }, type.label),
        el("span", { class: `pill ${detail.alive ? "alive" : "dead"}` },
          detail.alive ? "Vivo" : `Muerto · ${DEATH_CAUSES[detail.death_cause] || detail.death_cause}`),
        el("span", { class: "desc", style: { margin: "0" } }, species.name)),
      el("dl", { class: "facts" }, facts.map(([label, value, help]) =>
        el("div", { class: "fact", title: help || null }, el("dt", {}, label), el("dd", {}, value)))),
      this.diagram(detail, species.color),
      el("div", { class: "legend", style: { "margin-top": "8px" } },
        ...Object.values(NODE_TYPES).map((t) => el("span", {}, el("i", { class: "dot", style: { background: t.color } }), t.label)),
        el("span", {}, el("i", { class: "dot", style: { background: "#fff", border: "1.5px dashed #5d8199" } }), "Muerto"),
        el("span", {}, el("i", { class: "dot", style: { background: "#fff", border: "3px solid #0a78c6" } }), "Seleccionado")),
      el("div", { class: "section-label" }, `Linaje: camino desde la raíz (${detail.lineage.length} niveles)`),
      el("div", { class: "chips" }, lineage),
      el("div", { class: "section-label" }, `Hermanos (${detail.siblings.length})`),
      el("div", { class: "chips" }, siblings),
      el("div", { class: "section-label" }, `Hijos (${detail.children.length}) y peso de su subárbol`),
      el("div", { class: "chips" }, children),
      el("div", { class: "prune-box" },
        el("p", {}, el("strong", {}, "Podar linaje: "),
          `elimina este nodo y todo su subárbol (${plural(detail.subtree_weight, "nodo", "nodos")}) del árbol, como si se erradicara ese ` +
          `linaje en campo. Los organismos vivos de ese linaje mueren.${detail.node_type === "root" ? " Al ser la raíz, se elimina toda la especie." : ""}`),
        el("button", { class: "btn danger", onclick: () => this.handlers.onPrune(detail.id) }, "Podar este linaje")));
  }

  lineageChips(detail) {
    const lineage = detail.lineage;
    const items = [];
    const add = (node, index) => {
      if (items.length) items.push(el("span", { class: "chip-sep" }, "→"));
      const chip = this.chip(node, detail.id);
      chip.title = `Nivel ${index + 1}`;
      items.push(chip);
    };
    if (lineage.length <= 12) {
      lineage.forEach(add);
    } else {
      lineage.slice(0, 3).forEach(add);
      items.push(el("span", { class: "chip-sep" }, `→ … ${lineage.length - 9} niveles …`));
      lineage.slice(-6).forEach((node, i) => add(node, lineage.length - 6 + i));
    }
    return items;
  }

  diagram(detail, color) {
    const width = 760;
    const left = 92;
    const rowGap = 92;
    const rows = [];
    if (detail.parent) rows.push({ level: detail.level - 1, kind: "parent" });
    rows.push({ level: detail.level, kind: "self" });
    if (detail.children.length) rows.push({ level: detail.level + 1, kind: "children" });
    if (detail.children.some((c) => c.children.length)) rows.push({ level: detail.level + 2, kind: "grandchildren" });
    const height = rows.length * rowGap + 10;
    const yOf = (kind) => 44 + rows.findIndex((r) => r.kind === kind) * rowGap;
    const spread = (count, i, from = left, to = width - 20) => from + ((i + 0.5) * (to - from)) / count;

    const parts = [];
    const nodes = [];
    rows.forEach((row, i) => {
      const y = 44 + i * rowGap;
      parts.push(`<line x1="8" y1="${y}" x2="${width - 8}" y2="${y}" stroke="#13aee8" stroke-opacity=".35" stroke-dasharray="6 5"/>`);
      parts.push(`<text class="level-label" x="10" y="${y - 8}">Nivel ${row.level}</text>`);
    });

    const node = (n, x, y, r, { selected = false, labelAbove = false } = {}) => {
      const fill = NODE_TYPES[n.node_type].color;
      const dead = !n.alive;
      nodes.push(`<g class="node" data-id="${n.id}">` +
        (selected ? `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="#0a78c6" stroke-width="3"/>` : "") +
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" fill-opacity="${dead ? 0.45 : 1}" stroke="${dead ? "#5d8199" : "#ffffff"}"` +
        ` stroke-width="2.5" ${dead ? 'stroke-dasharray="3 2"' : ""}/>` +
        `<circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff" opacity=".55"/>` +
        `<text x="${x}" y="${labelAbove ? y - r - 6 : y + r + 13}" text-anchor="middle">#${n.id}</text></g>`);
    };

    const selfRow = [...detail.siblings, { ...detail, selected: true }];
    const mid = Math.floor(detail.siblings.length / 2);
    selfRow.splice(selfRow.length - 1, 1);
    selfRow.splice(mid, 0, { ...detail, selected: true });
    const ySelf = yOf("self");
    const selfX = {};
    selfRow.forEach((n, i) => { selfX[n.id] = spread(selfRow.length, i); });

    if (detail.parent) {
      const yParent = yOf("parent");
      const px = selfX[detail.id];
      selfRow.forEach((n) => parts.push(`<line x1="${px}" y1="${yParent}" x2="${selfX[n.id]}" y2="${ySelf}" stroke="#7aa6c2" stroke-width="2"/>`));
      node(detail.parent, px, yParent, 13, { labelAbove: true });
    }

    if (detail.children.length) {
      const yChildren = yOf("children");
      const slot = (width - 20 - left) / detail.children.length;
      detail.children.forEach((child, i) => {
        const cx = spread(detail.children.length, i);
        parts.push(`<line x1="${selfX[detail.id]}" y1="${ySelf}" x2="${cx}" y2="${yChildren}" stroke="#7aa6c2" stroke-width="2"/>`);
        if (child.children.length) {
          const yGrand = yOf("grandchildren");
          const shown = child.children.slice(0, 3);
          const from = left + i * slot;
          shown.forEach((g, j) => {
            const gx = from + ((j + 0.5) * slot) / shown.length;
            parts.push(`<line x1="${cx}" y1="${yChildren}" x2="${gx}" y2="${yGrand}" stroke="#a9c4d6" stroke-width="1.5"/>`);
            node(g, gx, yGrand, 8);
          });
          if (child.children.length > shown.length) {
            nodes.push(`<text x="${from + slot / 2}" y="${yGrand + 36}" text-anchor="middle" fill="#5d8199">+${child.children.length - shown.length}</text>`);
          }
        }
        node(child, cx, yChildren, 11);
      });
    }

    selfRow.forEach((n) => node(n, selfX[n.id], ySelf, n.selected ? 16 : 12, { selected: n.selected }));

    const holder = el("div");
    holder.innerHTML = `<svg class="tree-svg" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="Diagrama del vecindario del nodo #${detail.id} en su árbol">${parts.join("")}${nodes.join("")}</svg>`;
    const svg = holder.firstElementChild;
    svg.querySelectorAll(".node").forEach((g) => {
      g.addEventListener("click", () => this.handlers.onSelect(Number(g.dataset.id)));
    });
    return svg;
  }
}

/* =================================================================
   Application
   ================================================================= */
class App {
  constructor() {
    this.api = new ApiClient();
    this.catalog = null;
    this.state = null;
    this.speciesByKey = {};
    this.occupancy = new Map();
    this.hidden = new Set();
    this.selectedId = null;
    this.treeSpeciesKey = null;
    this.appliedSnapshot = "";
    this.playing = false;
    this.timer = null;
    this.queue = Promise.resolve();
    this.view = "case";

    this.map = new MapView(this.$("map"), {
      onClick: (cell) => this.handleMapClick(cell),
      onHover: (cell) => this.showHover(cell),
    });
    this.compass = new Compass(this.$("compass"));
    this.donut = new DonutChart(this.$("coverage"), this.$("coverage-legend"));
    this.spark = new LineChart(this.$("spark"), null, { compact: true });
    this.chart = new LineChart(this.$("chart"), this.$("chart-legend"));
    this.levels = new LevelsChart(this.$("levels-chart"));
    this.explorer = new NodeExplorer(this.$("node-explorer"), {
      onSelect: (id) => this.select(id),
      onPrune: (id) => this.prune(id),
      onGoto: (view) => this.showView(view),
      onSelectRoot: () => this.selectRoot(this.treeSpeciesKey),
    });

    this.bindControls();
    this.buildGuide();
    window.addEventListener("resize", () => this.redrawCharts());
  }

  $(id) { return document.getElementById(id); }

  /* Every server call goes through this queue so actions never overlap. */
  enqueue(task) {
    this.queue = this.queue.then(task).catch((error) => this.toast(error.message));
    return this.queue;
  }

  init() {
    this.enqueue(async () => {
      this.catalog = await this.api.getCatalog();
      this.catalogView = new SpeciesCatalogView(this.$("catalog-grid"), this.catalog, {
        onChange: () => this.updatePending(),
        onError: (message) => this.toast(message),
      });
      this.$("fire-radius").max = this.catalog.max_fire_radius;
      this.buildCaseSpecies();
      this.buildTerrainLegend();
      const state = await this.api.getState();
      this.applyState(state, { rebuild: true });
    });
  }

  /* ---------- navigation ---------- */
  showView(view) {
    this.view = view;
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("active", section.id === `view-${view}`);
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === view);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => this.redrawCharts());
  }

  redrawCharts() {
    if (!this.state) return;
    this.donut.update(this.state, this.hidden);
    this.spark.draw();
    this.chart.draw();
    this.levels.draw();
  }

  /* ---------- static content ---------- */
  buildCaseSpecies() {
    this.$("case-species").replaceChildren(...this.catalog.species.map((s) =>
      el("button", { class: "species-chip", onclick: () => this.showView("species") },
        orb(s.color), el("span", {}, s.name, el("small", {}, s.strategy)))));
  }

  buildTerrainLegend() {
    this.$("terrain-legend").replaceChildren(
      ...Object.values(TERRAIN).map((t) => el("span", {}, el("i", { style: { background: t.base } }), t.label)),
      el("span", {}, el("i", { style: { background: "transparent", border: "2px solid #0b3550" } }), "Raíz (fundador)"));
  }

  buildGuide() {
    this.$("guide-grid").replaceChildren(...GUIDE.map((item) =>
      el("article", { class: "glass card guide-card" },
        el("div", { class: "guide-icon", "aria-hidden": "true" }, item.icon),
        el("div", {}, el("h3", {}, item.title), el("p", {}, item.text), el("span", { class: "where" }, `Dónde: ${item.where}`)))));
  }

  /* ---------- controls ---------- */
  bindControls() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-view]");
      if (nav) this.showView(nav.dataset.view);
      const goto = event.target.closest("[data-goto]");
      if (goto) this.showView(goto.dataset.goto);
    });

    this.$("btn-step").addEventListener("click", () => this.advance(1));
    this.$("btn-step10").addEventListener("click", () => this.advance(10));
    this.$("btn-play").addEventListener("click", () => this.togglePlay());

    this.$("search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = this.$("search-input").value.replace("#", "").trim();
      const id = Number(value);
      if (!value || !Number.isInteger(id) || id < 1) {
        this.toast("Escribe un número de organismo válido, por ejemplo 125.");
        return;
      }
      this.select(id, { openTree: true });
    });

    document.querySelectorAll(".seg").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".seg").forEach((b) => {
          b.classList.toggle("active", b === button);
          b.setAttribute("aria-checked", String(b === button));
        });
        this.updateTool();
      });
    });
    this.$("fire-radius").addEventListener("input", () => this.updateTool());
    this.updateTool();

    const direction = this.$("wind-direction");
    const speed = this.$("wind-speed");
    const preview = () => this.showWind(Number(direction.value), Number(speed.value));
    const send = () => this.enqueue(async () =>
      this.applyState(await this.api.setWind(Number(direction.value), Number(speed.value))));
    for (const input of [direction, speed]) {
      input.addEventListener("input", preview);
      input.addEventListener("change", send);
    }

    this.$("btn-select-all").addEventListener("click", () => this.catalogView.selectAll());
    this.$("btn-defaults").addEventListener("click", () => this.catalogView.restoreDefaults());
    this.$("btn-apply").addEventListener("click", () => this.applySelection());
  }

  updateTool() {
    const tool = document.querySelector(".seg.active").dataset.tool;
    const radius = Number(this.$("fire-radius").value);
    this.$("fire-radius-value").textContent = `${radius} celdas`;
    const description = this.$("tool-desc");
    description.textContent = TOOL_DESCRIPTIONS[tool];
    description.classList.toggle("fire", tool === "fire");
    this.map.setTool(tool, radius);
  }

  showWind(direction, speed) {
    this.$("wind-direction-value").textContent = `${direction}° · ${compassName(direction)}`;
    this.$("wind-speed-value").textContent = `${speed.toFixed(1)} celdas/paso`;
    this.compass.draw(direction, speed);
  }

  /* ---------- state ---------- */
  async applyState(state, { rebuild = false } = {}) {
    this.state = state;
    this.speciesByKey = Object.fromEntries(state.species.map((s) => [s.key, s]));
    this.occupancy = new Map(state.organisms.map((o) => [`${o[2]},${o[3]}`, o]));

    if (rebuild) {
      this.catalogView.setFromState(state);
      this.appliedSnapshot = this.catalogView.snapshot();
      this.$("seed-input").value = state.seed;
      this.$("wind-direction").value = state.wind.direction;
      this.$("wind-speed").value = state.wind.speed;
      this.showWind(state.wind.direction, state.wind.speed);
      this.hidden = new Set([...this.hidden].filter((k) => this.speciesByKey[k]));
      if (!this.speciesByKey[this.treeSpeciesKey]) this.treeSpeciesKey = state.species[0].key;
      this.updatePending();
    }

    this.$("step-count").textContent = state.step;
    this.renderHero();
    this.renderKpis();
    this.renderDevices();
    this.map.setState(state);
    this.donut.update(state, this.hidden);
    this.spark.update(state.history, state.species);
    this.chart.update(state.history, state.species);
    this.renderTreeTabs();
    this.renderCompareTable();
    this.catalogView.updateStats(state);

    if (this.selectedId !== null) await this.loadDetail();

    if (this.playing && state.species.every((s) => s.stats.alive === 0)) {
      this.togglePlay();
      this.toast("Todas las especies se extinguieron.");
    }
  }

  renderHero() {
    const state = this.state;
    const alive = state.species.reduce((sum, s) => sum + s.stats.alive, 0);
    const extinct = state.species.filter((s) => s.stats.alive === 0).map((s) => s.name);
    const leader = [...state.species].sort((a, b) => b.stats.alive - a.stats.alive)[0];
    const total = state.width * state.height;
    if (state.step === 0) {
      this.$("hero-title").textContent = "Todo listo para empezar";
      this.$("hero-text").textContent = `${state.species.length} ${state.species.length === 1 ? "especie lista" : "especies listas"}, ` +
        "cada una con su fundador (la raíz de su árbol). Pulsa ▶ Reproducir o +1 para que empiecen a propagarse.";
    } else {
      this.$("hero-title").textContent = `Paso ${state.step}: ${alive} organismos vivos`;
      let text = leader.stats.alive
        ? `Domina ${leader.name} con ${leader.stats.alive} organismos (${((leader.stats.alive / total) * 100).toFixed(1)} % del mapa).`
        : "No queda ningún organismo vivo.";
      if (extinct.length) text += ` Extinta${extinct.length > 1 ? "s" : ""}: ${extinct.join(", ")}.`;
      this.$("hero-text").textContent = text;
    }
    const wind = state.wind;
    this.$("hero-wind").textContent = wind.speed > 0
      ? `Viento: ${wind.speed.toFixed(1)} celdas/paso hacia el ${compassName(wind.direction)}`
      : "Sin viento";
    this.$("hero-seed").textContent = `Mapa (semilla) ${state.seed}`;
  }

  renderKpis() {
    const species = this.state.species;
    this.$("kpi-alive").textContent = species.reduce((sum, s) => sum + s.stats.alive, 0);
    this.$("kpi-weight").textContent = species.reduce((sum, s) => sum + s.stats.weight, 0);
    this.$("kpi-height").textContent = Math.max(0, ...species.map((s) => s.stats.height));
  }

  renderDevices() {
    this.$("active-species").replaceChildren(...this.state.species.map((s) => {
      const visible = !this.hidden.has(s.key);
      const extinct = s.stats.alive === 0;
      const toggle = el("input", {
        type: "checkbox", checked: visible, "aria-label": `Mostrar ${s.name} en el mapa`,
        onchange: (event) => {
          if (event.target.checked) this.hidden.delete(s.key);
          else this.hidden.add(s.key);
          this.map.setHidden(this.hidden);
          this.donut.update(this.state, this.hidden);
          event.target.closest(".device").classList.toggle("off", !event.target.checked);
        },
      });
      return el("div", { class: `device${visible ? "" : " off"}${extinct ? " extinct" : ""}${isLight(s.color) ? " light" : ""}`, style: { "--c": s.color } },
        el("div", { class: "device-top" }, el("span", { class: "device-name" }, s.name),
          el("label", { class: "switch", title: "Mostrar u ocultar en el mapa" }, toggle, el("span"))),
        el("div", { class: "device-count" }, extinct ? "Extinta" : s.stats.alive, extinct ? null : el("small", {}, " vivos")));
    }));
  }

  renderTreeTabs() {
    const key = this.treeSpeciesKey;
    this.$("tree-tabs").replaceChildren(...this.state.species.map((s) =>
      el("button", {
        class: `tab${s.key === key ? " active" : ""}`, role: "tab", "aria-selected": String(s.key === key),
        onclick: () => { this.treeSpeciesKey = s.key; this.renderTreeTabs(); },
      }, orb(s.color), s.name)));

    const species = this.speciesByKey[key];
    const st = species.stats;
    const metrics = [
      ["Peso", st.weight, "Total de nodos del árbol (vivos y muertos)."],
      ["Altura", st.height, "Número de niveles: generaciones de la invasión."],
      ["Orden", st.order, "Máximo de hijos que puede tener un nodo."],
      ["Grado", st.degree, "El mayor número de hijos que tiene algún nodo."],
      ["Hojas", st.leaves, "Nodos sin hijos."],
      ["Ramas", st.branches, "Nodos con hijos que no son la raíz."],
      ["Vivos", st.alive, "Nodos que siguen vivos en el mapa."],
    ];
    const root = st.root
      ? el("div", { class: "metric" }, el("span", {}, "Raíz"),
        el("strong", {}, `#${st.root.id}`),
        el("button", { class: "link", onclick: () => this.select(st.root.id) }, "Ver en el explorador"))
      : el("div", { class: "metric" }, el("span", {}, "Raíz"), el("strong", {}, "—"), el("small", {}, "El árbol fue podado por completo."));
    this.$("tree-metrics").replaceChildren(
      ...metrics.map(([label, value, help]) =>
        el("div", { class: "metric", title: help }, el("span", {}, label), el("strong", {}, value), el("small", {}, help))),
      root);
    this.levels.update(st.level_sizes, species.color);
  }

  renderCompareTable() {
    const header = [
      ["Especie", ""],
      ["Vivos", "Organismos vivos ahora."],
      ["Peso", "Nodos totales del árbol."],
      ["Altura", "Generaciones (niveles) del árbol."],
      ["Grado", "Máximo de hijos de un nodo (el orden es el límite)."],
      ["Alcance", "Distancia máxima de un nodo a la raíz, en celdas."],
      ["Frente medido", "Alcance máximo dividido por los pasos simulados."],
      ["Frente teórico", "Velocidad de Fisher-KPP v = 2√(rD), cota superior."],
      ["D config.", "Coeficiente de difusión configurado."],
      ["D estimado", "Difusión medida con las aristas del árbol: (σx² + σy²)/4."],
    ];
    const step = this.state.step;
    const rows = this.state.species.map((s) => {
      const st = s.stats;
      return el("tr", {},
        el("td", {}, orb(s.color), s.name),
        el("td", {}, st.alive), el("td", {}, st.weight), el("td", {}, st.height),
        el("td", {}, `${st.degree}/${st.order}`),
        el("td", {}, formatNumber(st.max_reach, 1)),
        el("td", {}, step ? formatNumber(st.max_reach / step, 3) : "—"),
        el("td", {}, formatNumber(s.fisher_speed, 3)),
        el("td", {}, formatNumber(s.traits.diffusion)),
        el("td", {}, formatNumber(st.estimated_diffusion)));
    });
    this.$("compare-table").replaceChildren(
      el("thead", {}, el("tr", {}, header.map(([label, help]) => el("th", { title: help || null }, label)))),
      el("tbody", {}, rows));
  }

  updatePending() {
    if (!this.catalogView) return;
    const count = this.catalogView.selection.size;
    this.$("selection-count").textContent = `${count} de ${this.catalog.species.length} seleccionadas`;
    this.$("pending-note").hidden = this.catalogView.snapshot() === this.appliedSnapshot;
  }

  /* ---------- node detail ---------- */
  async loadDetail() {
    try {
      const detail = await this.api.getOrganism(this.selectedId);
      if (detail.species !== this.treeSpeciesKey) {
        this.treeSpeciesKey = detail.species;
        this.renderTreeTabs();
      }
      this.map.setDetail(detail);
      this.explorer.render(detail, this.speciesByKey[detail.species]);
    } catch (error) {
      if (error.status !== 404) throw error;
      this.toast(error.message);
      this.selectedId = null;
      this.map.setDetail(null);
      this.explorer.clear();
    }
  }

  select(id, { openTree = false } = {}) {
    if (id === null || id === undefined) return;
    this.selectedId = id;
    this.enqueue(async () => {
      await this.loadDetail();
      if (openTree && this.selectedId !== null) this.showView("tree");
    });
  }

  selectRoot(key) {
    const species = this.speciesByKey[key];
    if (species && species.stats.root) this.select(species.stats.root.id);
    else this.toast("Esta especie ya no tiene raíz: su árbol fue podado.");
  }

  /* ---------- actions ---------- */
  advance(count) {
    this.enqueue(async () => this.applyState(await this.api.step(count)));
  }

  applySelection() {
    const keys = [...this.catalogView.selection];
    const traits = Object.fromEntries(keys.map((k) => [k, this.catalogView.traits[k]]));
    const seedText = this.$("seed-input").value.trim();
    const seed = seedText === "" ? null : Number(seedText);
    if (this.playing) this.togglePlay();
    this.selectedId = null;
    this.map.setDetail(null);
    this.explorer.clear();
    this.enqueue(async () => {
      await this.applyState(await this.api.reset(seed, keys, traits), { rebuild: true });
      this.toast(`Simulación nueva con ${keys.length} ${keys.length === 1 ? "especie" : "especies"}.`);
      this.showView("sim");
    });
  }

  prune(id) {
    const ok = window.confirm(`¿Podar el linaje de #${id}? Se eliminarán del árbol el organismo y todos sus descendientes.`);
    if (!ok) return;
    this.enqueue(async () => {
      const result = await this.api.prune(id);
      this.selectedId = null;
      this.map.setDetail(null);
      this.explorer.clear();
      await this.applyState(result);
      this.toast(`Poda: ${plural(result.event.removed, "nodo eliminado", "nodos eliminados")} (${result.event.alive_removed} vivos).`);
    });
  }

  handleMapClick(cell) {
    if (this.map.tool === "fire") {
      this.enqueue(async () => {
        const result = await this.api.fire(cell.col, cell.row, this.map.fireRadius);
        await this.applyState(result);
        this.toast(`Incendio en (${cell.col}, ${cell.row}): ${plural(result.event.burned, "organismo murió", "organismos murieron")}.`);
      });
      return;
    }
    const organism = this.occupancy.get(`${cell.col},${cell.row}`);
    if (organism && !this.hidden.has(organism[1])) {
      this.select(organism[0]);
      this.toast(`Organismo #${organism[0]} seleccionado. Míralo en detalle en la vista Árbol.`);
    } else {
      this.toast("No hay un organismo visible en esa celda.");
    }
  }

  showHover(cell) {
    const info = this.$("hover-info");
    if (!cell || !this.state) {
      info.textContent = "Pasa el cursor sobre el mapa";
      return;
    }
    const terrain = TERRAIN[this.state.terrain[cell.row][cell.col]].label;
    const organism = this.occupancy.get(`${cell.col},${cell.row}`);
    const who = organism && !this.hidden.has(organism[1]) ? ` · ${this.speciesByKey[organism[1]].name} #${organism[0]}` : "";
    info.textContent = `(${cell.col}, ${cell.row}) · ${terrain}${who}`;
  }

  togglePlay() {
    this.playing = !this.playing;
    this.$("btn-play").textContent = this.playing ? "⏸ Pausar" : "▶ Reproducir";
    clearTimeout(this.timer);
    if (this.playing) this.tick();
  }

  tick() {
    if (!this.playing) return;
    this.enqueue(async () => this.applyState(await this.api.step(1))).then(() => {
      if (this.playing) this.timer = setTimeout(() => this.tick(), Number(this.$("play-speed").value));
    });
  }

  toast(message) {
    const toast = this.$("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
  }
}

window.app = new App();
window.app.init();
