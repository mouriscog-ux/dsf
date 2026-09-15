export class SimMap {
  constructor() {
    this.initialNodes = [
      { id: 'A', name: 'Av. Liberdade / Barão de Iguape', x: 115, y: 55, type: 'normal' },
      { id: 'B', name: 'Galvão Bueno / Barão de Iguape', x: 210, y: 72, type: 'normal' },
      { id: 'C', name: 'Conselheiro Furtado / Galvão Bueno', x: 312, y: 92, type: 'normal' },
      { id: 'D', name: 'Av. Liberdade / Praça da Liberdade', x: 96, y: 145, type: 'normal' },
      { id: 'E', name: 'Praça da Liberdade', x: 202, y: 162, type: 'exit' },
      { id: 'F', name: 'Conselheiro Furtado / Fagundes', x: 330, y: 176, type: 'normal' },
      { id: 'G', name: 'Av. Liberdade / São Joaquim', x: 70, y: 245, type: 'normal' },
      { id: 'H', name: 'Galvão Bueno / São Joaquim', x: 188, y: 255, type: 'normal' },
      { id: 'I', name: 'Metrô São Joaquim', x: 318, y: 270, type: 'exit' },
      { id: 'J', name: 'Av. Liberdade / Vergueiro', x: 52, y: 350, type: 'normal' },
      { id: 'K', name: 'Galvão Bueno / Tamandaré', x: 172, y: 355, type: 'normal' },
      { id: 'L', name: 'Rua Tamandaré / saída leste', x: 312, y: 344, type: 'exit' },
      { id: 'M', name: 'Viaduto Osaka', x: 252, y: 218, type: 'normal' },
      { id: 'N', name: 'Rua dos Estudantes', x: 420, y: 218, type: 'normal' },
      { id: 'O', name: 'Rua Vergueiro leste', x: 430, y: 335, type: 'normal' },
      { id: 'P', name: 'Rua da Glória', x: 145, y: 112, type: 'normal' }
    ];

    this.initialEdges = [
      { id: 'AB', from: 'A', to: 'B', name: 'R. Barão de Iguape', blocked: false, kind: 'street', geometry: [{ x: 115, y: 55 }, { x: 158, y: 61 }, { x: 210, y: 72 }] },
      { id: 'BC', from: 'B', to: 'C', name: 'R. Barão de Iguape leste', blocked: false, kind: 'street', geometry: [{ x: 210, y: 72 }, { x: 262, y: 80 }, { x: 312, y: 92 }] },
      { id: 'AD', from: 'A', to: 'D', name: 'Av. da Liberdade norte', blocked: false, kind: 'street', geometry: [{ x: 115, y: 55 }, { x: 106, y: 96 }, { x: 96, y: 145 }] },
      { id: 'DE', from: 'D', to: 'E', name: 'Praça da Liberdade oeste', blocked: false, kind: 'street', geometry: [{ x: 96, y: 145 }, { x: 142, y: 154 }, { x: 202, y: 162 }] },
      { id: 'EF', from: 'E', to: 'F', name: 'R. dos Estudantes norte', blocked: false, kind: 'street', geometry: [{ x: 202, y: 162 }, { x: 264, y: 167 }, { x: 330, y: 176 }] },
      { id: 'CF', from: 'C', to: 'F', name: 'R. Conselheiro Furtado', blocked: false, kind: 'street', geometry: [{ x: 312, y: 92 }, { x: 323, y: 132 }, { x: 330, y: 176 }] },
      { id: 'DG', from: 'D', to: 'G', name: 'Av. da Liberdade central', blocked: false, kind: 'street', geometry: [{ x: 96, y: 145 }, { x: 82, y: 195 }, { x: 70, y: 245 }] },
      { id: 'EH', from: 'E', to: 'H', name: 'R. Galvão Bueno central', blocked: false, kind: 'street', geometry: [{ x: 202, y: 162 }, { x: 194, y: 208 }, { x: 188, y: 255 }] },
      { id: 'FI', from: 'F', to: 'I', name: 'R. Fagundes', blocked: false, kind: 'street', geometry: [{ x: 330, y: 176 }, { x: 326, y: 224 }, { x: 318, y: 270 }] },
      { id: 'GH', from: 'G', to: 'H', name: 'R. São Joaquim', blocked: false, kind: 'street', geometry: [{ x: 70, y: 245 }, { x: 126, y: 252 }, { x: 188, y: 255 }] },
      { id: 'HI', from: 'H', to: 'I', name: 'R. São Joaquim leste', blocked: false, kind: 'street', geometry: [{ x: 188, y: 255 }, { x: 250, y: 262 }, { x: 318, y: 270 }] },
      { id: 'GJ', from: 'G', to: 'J', name: 'Av. da Liberdade sul', blocked: false, kind: 'street', geometry: [{ x: 70, y: 245 }, { x: 58, y: 300 }, { x: 52, y: 350 }] },
      { id: 'HK', from: 'H', to: 'K', name: 'R. Galvão Bueno sul', blocked: false, kind: 'street', geometry: [{ x: 188, y: 255 }, { x: 180, y: 302 }, { x: 172, y: 355 }] },
      { id: 'IL', from: 'I', to: 'L', name: 'R. Tamandaré norte', blocked: false, kind: 'street', geometry: [{ x: 318, y: 270 }, { x: 314, y: 306 }, { x: 312, y: 344 }] },
      { id: 'JK', from: 'J', to: 'K', name: 'R. Vergueiro oeste', blocked: false, kind: 'street', geometry: [{ x: 52, y: 350 }, { x: 108, y: 357 }, { x: 172, y: 355 }] },
      { id: 'KL', from: 'K', to: 'L', name: 'R. Tamandaré', blocked: false, kind: 'street', geometry: [{ x: 172, y: 355 }, { x: 240, y: 350 }, { x: 312, y: 344 }] },
      { id: 'EM', from: 'E', to: 'M', name: 'Viaduto Osaka oeste', blocked: false, kind: 'street', geometry: [{ x: 202, y: 162 }, { x: 230, y: 190 }, { x: 252, y: 218 }] },
      { id: 'MN', from: 'M', to: 'N', name: 'Viaduto Osaka leste', blocked: false, kind: 'street', geometry: [{ x: 252, y: 218 }, { x: 335, y: 216 }, { x: 420, y: 218 }] },
      { id: 'MI', from: 'M', to: 'I', name: 'Ligação Osaka - São Joaquim', blocked: false, kind: 'street', geometry: [{ x: 252, y: 218 }, { x: 290, y: 242 }, { x: 318, y: 270 }] },
      { id: 'NO', from: 'N', to: 'O', name: 'R. dos Estudantes sul', blocked: false, kind: 'street', geometry: [{ x: 420, y: 218 }, { x: 426, y: 276 }, { x: 430, y: 335 }] },
      { id: 'LO', from: 'L', to: 'O', name: 'R. Vergueiro leste', blocked: false, kind: 'street', geometry: [{ x: 312, y: 344 }, { x: 370, y: 338 }, { x: 430, y: 335 }] },
      { id: 'AP', from: 'A', to: 'P', name: 'R. da Glória norte', blocked: false, kind: 'street', geometry: [{ x: 115, y: 55 }, { x: 130, y: 84 }, { x: 145, y: 112 }] },
      { id: 'PE', from: 'P', to: 'E', name: 'R. da Glória', blocked: false, kind: 'street', geometry: [{ x: 145, y: 112 }, { x: 172, y: 136 }, { x: 202, y: 162 }] },
      { id: 'PB', from: 'P', to: 'B', name: 'Ligação Galvão Bueno norte', blocked: false, kind: 'street', geometry: [{ x: 145, y: 112 }, { x: 176, y: 94 }, { x: 210, y: 72 }] }
    ];
    this.initialEdges.forEach(edge => { edge.weight = this.measureGeometry(edge.geometry); });

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

  measureGeometry(points = []) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return Math.round(total) || 1;
  }
}
