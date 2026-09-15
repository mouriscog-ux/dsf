export class Routing {
  constructor(graph) {
    this.graph = graph;
  }

  euclideanDistance(nodeA, nodeB) {
    return Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
  }

  findPathAStar(startId, goalId) {
    return this.findPath(startId, goalId, true);
  }

  findPathDijkstra(startId, goalId) {
    return this.findPath(startId, goalId, false);
  }

  findPath(startId, goalId, useHeuristic) {
    const startNode = this.graph.nodesMap.get(startId);
    const goalNode = this.graph.nodesMap.get(goalId);
    if (!startNode || !goalNode || startNode.type === 'blocked' || goalNode.type === 'blocked') return null;

    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const openSet = new Set([startId]);
    const closedSet = new Set();
    const explorationOrder = [];

    for (const node of this.graph.nodesMap.values()) {
      gScore.set(node.id, Infinity);
      fScore.set(node.id, Infinity);
    }

    gScore.set(startId, 0);
    fScore.set(startId, useHeuristic ? this.euclideanDistance(startNode, goalNode) : 0);

    while (openSet.size) {
      let currentId = null;
      let lowestScore = Infinity;
      for (const id of openSet) {
        if (fScore.get(id) < lowestScore) {
          lowestScore = fScore.get(id);
          currentId = id;
        }
      }

      if (!currentId) break;
      openSet.delete(currentId);
      closedSet.add(currentId);
      explorationOrder.push(currentId);

      if (currentId === goalId) {
        const path = [currentId];
        let cursor = currentId;
        while (cameFrom.has(cursor)) {
          cursor = cameFrom.get(cursor);
          path.unshift(cursor);
        }
        return {
          success: true,
          path,
          cost: gScore.get(goalId),
          distance: gScore.get(goalId),
          nodesExplored: closedSet.size,
          explorationOrder,
          closedSet: Array.from(closedSet),
          openSet: Array.from(openSet)
        };
      }

      for (const neighbor of this.graph.getNeighbors(currentId)) {
        const neighborId = neighbor.node.id;
        if (closedSet.has(neighborId)) continue;
        const tentativeG = gScore.get(currentId) + neighbor.dynamicCost;
        if (tentativeG >= gScore.get(neighborId)) continue;
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        const h = useHeuristic ? this.euclideanDistance(neighbor.node, goalNode) : 0;
        fScore.set(neighborId, tentativeG + h);
        openSet.add(neighborId);
      }
    }

    return {
      success: false,
      path: [],
      cost: Infinity,
      distance: Infinity,
      nodesExplored: closedSet.size,
      explorationOrder,
      closedSet: Array.from(closedSet),
      openSet: Array.from(openSet)
    };
  }
}
