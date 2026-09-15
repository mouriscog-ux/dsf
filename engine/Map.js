const DEFAULT_GEO_BOUNDS = { south: -23.5600, north: -23.5540, west: -46.6400, east: -46.6320 };
const MODEL_BOUNDS = { minX: 40, maxX: 440, minY: 40, maxY: 400 };

const FALLBACK_ROADS = {
  nodes: [
    { id: 'A', name: 'Av. Liberdade / Barao de Iguape', x: 115, y: 55, lat: -23.55425, lng: -46.6385, type: 'normal' },
    { id: 'B', name: 'Galvao Bueno / Barao de Iguape', x: 210, y: 72, lat: -23.55453, lng: -46.6366, type: 'normal' },
    { id: 'C', name: 'Conselheiro Furtado / Galvao Bueno', x: 312, y: 92, lat: -23.55487, lng: -46.6346, type: 'normal' },
    { id: 'D', name: 'Av. Liberdade / Praca da Liberdade', x: 96, y: 145, lat: -23.55575, lng: -46.63888, type: 'normal' },
    { id: 'E', name: 'Praca da Liberdade', x: 202, y: 162, lat: -23.55603, lng: -46.63676, type: 'exit' },
    { id: 'F', name: 'Conselheiro Furtado / Fagundes', x: 330, y: 176, lat: -23.55627, lng: -46.63424, type: 'normal' },
    { id: 'G', name: 'Av. Liberdade / Sao Joaquim', x: 70, y: 245, lat: -23.55792, lng: -46.6394, type: 'normal' },
    { id: 'H', name: 'Galvao Bueno / Sao Joaquim', x: 188, y: 255, lat: -23.55808, lng: -46.63704, type: 'normal' },
    { id: 'I', name: 'Metro Sao Joaquim', x: 318, y: 270, lat: -23.55833, lng: -46.63444, type: 'exit' },
    { id: 'J', name: 'Av. Liberdade / Vergueiro', x: 52, y: 350, lat: -23.55967, lng: -46.63976, type: 'normal' },
    { id: 'K', name: 'Galvao Bueno / Tamandare', x: 172, y: 355, lat: -23.55975, lng: -46.63736, type: 'normal' },
    { id: 'L', name: 'Rua Tamandare / saida leste', x: 312, y: 344, lat: -23.55957, lng: -46.63456, type: 'exit' }
  ],
  edges: [
    ['A', 'B', 'R. Barao de Iguape'], ['B', 'C', 'R. Barao de Iguape'],
    ['A', 'D', 'Av. da Liberdade'], ['D', 'E', 'Praca da Liberdade'],
    ['E', 'F', 'R. dos Estudantes'], ['C', 'F', 'R. Conselheiro Furtado'],
    ['D', 'G', 'Av. da Liberdade'], ['E', 'H', 'R. Galvao Bueno'],
    ['F', 'I', 'R. Fagundes'], ['G', 'H', 'R. Sao Joaquim'],
    ['H', 'I', 'R. Sao Joaquim'], ['G', 'J', 'Av. da Liberdade'],
    ['H', 'K', 'R. Galvao Bueno'], ['I', 'L', 'R. Tamandare'],
    ['J', 'K', 'R. Vergueiro'], ['K', 'L', 'R. Tamandare']
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function haversine(a, b) {
  const earth = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

export class SimMap {
  constructor() {
    this.geoBounds = { ...DEFAULT_GEO_BOUNDS };
    this.modelBounds = { ...MODEL_BOUNDS };
    this.initialNodes = [];
    this.initialEdges = [];
    this.nodes = [];
    this.edges = [];
    this.dynamicCounter = 1;
    this.loadFallback();
  }

  async loadRealRoads() {
    const data = await this.fetchOverpassRoads();
    this.buildFromOverpass(data);
    this.reset();
  }

  async fetchOverpassRoads() {
    const { south, west, north, east } = this.geoBounds;
    const query = `
      [out:json][timeout:25];
      (
        way["highway"]["highway"!~"footway|cycleway|path|steps|corridor|elevator|escalator|service|track|construction|proposed"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;
    `;
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.fr/api/interpreter'
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: 'data=' + encodeURIComponent(query.trim()),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(endpoint + ' retornou HTTP ' + response.status);
        return response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Overpass indisponivel');
  }

  buildFromOverpass(data) {
    const osmNodes = new Map();
    const usage = new Map();
    const ways = data.elements.filter(item => item.type === 'way' && item.nodes?.length > 1);

    for (const item of data.elements) {
      if (item.type !== 'node') continue;
      osmNodes.set(item.id, { osmId: item.id, lat: item.lat, lng: item.lon, ...this.latLngToXY(item.lat, item.lon) });
    }

    for (const way of ways) {
      for (const nodeId of way.nodes) usage.set(nodeId, (usage.get(nodeId) || 0) + 1);
    }

    const graphNodes = new Map();
    const getGraphNode = (osmId) => {
      if (graphNodes.has(osmId)) return graphNodes.get(osmId);
      const source = osmNodes.get(osmId);
      if (!source) return null;
      const node = {
        id: 'osm-' + osmId,
        osmId,
        name: 'Cruzamento OSM ' + osmId,
        type: 'normal',
        x: source.x,
        y: source.y,
        lat: source.lat,
        lng: source.lng
      };
      graphNodes.set(osmId, node);
      return node;
    };

    const edges = [];
    const seen = new Set();
    for (const way of ways) {
      const wayNodes = way.nodes.filter(id => osmNodes.has(id));
      let startIndex = 0;
      for (let i = 1; i < wayNodes.length; i++) {
        const isSplit = i === wayNodes.length - 1 || (usage.get(wayNodes[i]) || 0) > 1;
        if (!isSplit) continue;
        const fromOsm = wayNodes[startIndex];
        const toOsm = wayNodes[i];
        if (fromOsm !== toOsm) {
          const from = getGraphNode(fromOsm);
          const to = getGraphNode(toOsm);
          const geometry = wayNodes.slice(startIndex, i + 1).map(id => {
            const n = osmNodes.get(id);
            return { x: n.x, y: n.y, lat: n.lat, lng: n.lng };
          });
          const key = [from.id, to.id, way.id, startIndex, i].join(':');
          if (from && to && geometry.length > 1 && !seen.has(key)) {
            seen.add(key);
            const name = way.tags?.name || way.tags?.official_name || way.tags?.highway || 'Rua sem nome';
            edges.push({
              id: 'osm-way-' + way.id + '-' + startIndex + '-' + i,
              osmWayId: way.id,
              from: from.id,
              to: to.id,
              name,
              blocked: false,
              reason: null,
              kind: 'street',
              geometry,
              weight: this.measureGeometry(geometry)
            });
          }
        }
        startIndex = i;
      }
    }

    this.initialNodes = Array.from(graphNodes.values());
    this.initialEdges = edges;
    this.ensureSafeExit();
  }

  ensureSafeExit() {
    const target = { lat: -23.55732, lng: -46.63592 };
    let best = null;
    for (const node of this.initialNodes) {
      const distance = haversine(node, target);
      if (!best || distance < best.distance) best = { node, distance };
    }
    if (best) {
      best.node.type = 'exit';
      best.node.name = 'SAIDA SEGURA - Liberdade';
    }
  }

  loadFallback() {
    this.initialNodes = clone(FALLBACK_ROADS.nodes);
    this.initialEdges = FALLBACK_ROADS.edges.map(([from, to, name]) => {
      const a = this.initialNodes.find(n => n.id === from);
      const b = this.initialNodes.find(n => n.id === to);
      const geometry = [{ x: a.x, y: a.y, lat: a.lat, lng: a.lng }, { x: b.x, y: b.y, lat: b.lat, lng: b.lng }];
      return { id: from + to, from, to, name, blocked: false, kind: 'street', reason: null, geometry, weight: this.measureGeometry(geometry) };
    });
    this.reset();
  }

  latLngToXY(lat, lng) {
    const { south, north, west, east } = this.geoBounds;
    const { minX, maxX, minY, maxY } = this.modelBounds;
    return {
      x: minX + (lng - west) / (east - west) * (maxX - minX),
      y: minY + (north - lat) / (north - south) * (maxY - minY)
    };
  }

  xyToLatLng(x, y) {
    const { south, north, west, east } = this.geoBounds;
    const { minX, maxX, minY, maxY } = this.modelBounds;
    return {
      lat: north - (y - minY) / (maxY - minY) * (north - south),
      lng: west + (x - minX) / (maxX - minX) * (east - west)
    };
  }

  reset() {
    this.nodes = clone(this.initialNodes);
    this.edges = clone(this.initialEdges);
    this.dynamicCounter = 1;
  }

  getNodes() { return this.nodes; }
  getEdges() { return this.edges; }
  getNode(id) { return this.nodes.find(n => n.id === id); }
  getEdgeById(id) { return this.edges.find(e => e.id === id); }

  getEdge(fromId, toId) {
    return this.edges.find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId));
  }

  setEdgeBlocked(edgeId, blocked, reason = 'block') {
    const edge = this.getEdgeById(edgeId);
    if (!edge) return null;
    edge.blocked = Boolean(blocked);
    edge.reason = blocked ? reason : null;
    return edge;
  }

  getEdgeGeometry(edge) {
    return edge?.geometry?.length >= 2 ? edge.geometry : [];
  }

  measureGeometry(points = []) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
    return Math.max(1, Math.round(total));
  }

  addPointOnEdge(edgeId, snap, type = 'normal', name = 'Ponto na rua') {
    const edge = this.getEdgeById(edgeId);
    if (!edge) return null;
    const nodeId = 'dyn-' + this.dynamicCounter++;
    const nodeLatLng = this.xyToLatLng(snap.point.x, snap.point.y);
    const node = { id: nodeId, name, type, x: snap.point.x, y: snap.point.y, lat: nodeLatLng.lat, lng: nodeLatLng.lng };
    this.nodes.push(node);

    const index = Math.max(1, Math.min(snap.segmentIndex || 1, edge.geometry.length - 1));
    const before = edge.geometry.slice(0, index);
    const after = edge.geometry.slice(index);
    const snapped = { x: node.x, y: node.y, lat: node.lat, lng: node.lng };
    const aGeometry = [...before, snapped];
    const bGeometry = [snapped, ...after];
    const wasBlocked = edge.blocked;
    const reason = edge.reason;
    this.edges = this.edges.filter(e => e.id !== edge.id);
    this.edges.push(this.makeSplitEdge(edge, edge.from, node.id, aGeometry, 'a', wasBlocked, reason));
    this.edges.push(this.makeSplitEdge(edge, node.id, edge.to, bGeometry, 'b', wasBlocked, reason));
    return node;
  }

  makeSplitEdge(edge, from, to, geometry, suffix, blocked, reason) {
    return {
      ...edge,
      id: edge.id + '-split-' + suffix + '-' + this.dynamicCounter,
      from,
      to,
      geometry,
      blocked,
      reason,
      weight: this.measureGeometry(geometry)
    };
  }
}
