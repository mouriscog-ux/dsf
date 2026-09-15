export class Graph {
  constructor(map) {
    this.map = map;
    this.nodesMap = new Map();
    this.adjList = new Map();
    this.build();
  }

  build() {
    this.nodesMap.clear();
    this.adjList.clear();

    for (const node of this.map.getNodes()) {
      this.nodesMap.set(node.id, node);
      this.adjList.set(node.id, []);
    }

    for (const edge of this.map.getEdges()) {
      edge.blocked = Boolean(edge.blocked);
      edge.riskLevel = edge.riskLevel || 0;
      edge.congestion = edge.congestion || 0;
      if (!this.adjList.has(edge.from) || !this.adjList.has(edge.to)) continue;
      this.adjList.get(edge.from).push(edge);
      this.adjList.get(edge.to).push({ ...edge, from: edge.to, to: edge.from });
    }
  }

  getEdge(fromId, toId) {
    return (this.adjList.get(fromId) || []).find(edge => edge.to === toId) || null;
  }

  getNeighbors(nodeId) {
    return (this.adjList.get(nodeId) || [])
      .filter(edge => !edge.blocked)
      .map(edge => ({ node: this.nodesMap.get(edge.to), edge, dynamicCost: this.calculateDynamicCost(edge) }))
      .filter(entry => entry.node && entry.node.type !== 'blocked');
  }

  calculateDynamicCost(edge) {
    if (edge.blocked) return Infinity;
    let cost = edge.weight;
    if (edge.riskLevel > 0) cost += edge.riskLevel * 2;
    if (edge.congestion >= 16) cost += 100;
    else if (edge.congestion >= 6) cost += 30;
    return cost;
  }
}
