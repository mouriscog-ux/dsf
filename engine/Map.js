export class SimMap {
  constructor() {
    this.initialNodes = [
      { id: 'A', name: 'Entrada Norte', x: 80, y: 70, type: 'normal', lat: -23.5549, lng: -46.6388 },
      { id: 'B', name: 'Cruzamento Central Norte', x: 240, y: 70, type: 'normal', lat: -23.5549, lng: -46.6359 },
      { id: 'C', name: 'Rua da Escola', x: 400, y: 70, type: 'normal', lat: -23.5549, lng: -46.6330 },
      { id: 'D', name: 'Bairro Oeste', x: 80, y: 220, type: 'normal', lat: -23.5571, lng: -46.6388 },
      { id: 'E', name: 'Praça Central', x: 240, y: 220, type: 'normal', lat: -23.5571, lng: -46.6359 },
      { id: 'F', name: 'Hospital', x: 400, y: 220, type: 'normal', lat: -23.5571, lng: -46.6330 },
      { id: 'G', name: 'Terminal Sul', x: 80, y: 370, type: 'normal', lat: -23.5593, lng: -46.6388 },
      { id: 'H', name: 'Cruzamento Sul', x: 240, y: 370, type: 'normal', lat: -23.5593, lng: -46.6359 },
      { id: 'I', name: 'Saída Segura', x: 400, y: 370, type: 'exit', lat: -23.5593, lng: -46.6330 }
    ];

    this.initialEdges = [
      { id: 'AB', from: 'A', to: 'B', weight: 160, name: 'Rua Norte', blocked: false, kind: 'street' },
      { id: 'BC', from: 'B', to: 'C', weight: 160, name: 'Rua Norte Leste', blocked: false, kind: 'street' },
      { id: 'AD', from: 'A', to: 'D', weight: 150, name: 'Av. Oeste', blocked: false, kind: 'street' },
      { id: 'BE', from: 'B', to: 'E', weight: 150, name: 'Rua Central', blocked: false, kind: 'street' },
      { id: 'CF', from: 'C', to: 'F', weight: 150, name: 'Av. Leste', blocked: false, kind: 'street' },
      { id: 'DE', from: 'D', to: 'E', weight: 160, name: 'Rua do Comércio', blocked: false, kind: 'street' },
      { id: 'EF', from: 'E', to: 'F', weight: 160, name: 'Rua do Hospital', blocked: false, kind: 'street' },
      { id: 'DG', from: 'D', to: 'G', weight: 150, name: 'Av. Oeste Sul', blocked: false, kind: 'street' },
      { id: 'EH', from: 'E', to: 'H', weight: 150, name: 'Rua Central Sul', blocked: false, kind: 'street' },
      { id: 'FI', from: 'F', to: 'I', weight: 150, name: 'Corredor da Saída', blocked: false, kind: 'street' },
      { id: 'GH', from: 'G', to: 'H', weight: 160, name: 'Rua Sul', blocked: false, kind: 'street' },
      { id: 'HI', from: 'H', to: 'I', weight: 160, name: 'Rua Sul Leste', blocked: false, kind: 'street' },
      { id: 'BF', from: 'B', to: 'F', weight: 235, name: 'Diagonal de Serviço', blocked: false, kind: 'street', geometry: [{ x: 240, y: 70 }, { x: 315, y: 145 }, { x: 400, y: 220 }] },
      { id: 'DH', from: 'D', to: 'H', weight: 235, name: 'Rota Alternativa Sul', blocked: false, kind: 'street', geometry: [{ x: 80, y: 220 }, { x: 150, y: 310 }, { x: 240, y: 370 }] }
    ];

    this.nodes = [];
    this.edges = [];
    this.reset();
  }

  reset() {
    this.nodes = JSON.parse(JSON.stringify(this.initialNodes));
    this.edges = JSON.parse(JSON.stringify(this.initialEdges));
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
    if (edge.geometry && edge.geometry.length >= 2) return edge.geometry;
    const from = this.getNode(edge.from);
    const to = this.getNode(edge.to);
    return from && to ? [{ x: from.x, y: from.y }, { x: to.x, y: to.y }] : [];
  }
}
