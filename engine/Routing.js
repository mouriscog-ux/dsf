export class Routing {
    constructor(graph) {
        this.graph = graph;
    }

    euclideanDistance(nodeA, nodeB) {
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    findPathAStar(startId, goalId) {
        return this._findPath(startId, goalId, true);
    }

    findPathDijkstra(startId, goalId) {
        return this._findPath(startId, goalId, false);
    }

    _findPath(startId, goalId, useHeuristic) {
        const startNode = this.graph.nodesMap.get(startId);
        const goalNode = this.graph.nodesMap.get(goalId);

        if (!startNode || !goalNode) return null;
        if (startNode.type === 'blocked' || goalNode.type === 'blocked') return null;

        const gScore = new Map();
        const fScore = new Map();
        const cameFrom = new Map();
        const openSet = new Set([startId]);
        const closedSet = new Set();
        const explorationOrder = [];

        this.graph.nodesMap.forEach(n => {
            gScore.set(n.id, Infinity);
            fScore.set(n.id, Infinity);
        });

        gScore.set(startId, 0);
        fScore.set(startId, useHeuristic ? this.euclideanDistance(startNode, goalNode) : 0);

        while (openSet.size > 0) {
            let currentId = null;
            let lowestF = Infinity;

            for (const id of openSet) {
                if (fScore.get(id) < lowestF) {
                    lowestF = fScore.get(id);
                    currentId = id;
                }
            }

            if (!currentId) break;

            openSet.delete(currentId);
            closedSet.add(currentId);
            explorationOrder.push(currentId);

            if (currentId === goalId) {
                // Reconstruct path
                const path = [currentId];
                let curr = currentId;
                let cost = gScore.get(goalId);
                let distance = 0;

                while (cameFrom.has(curr)) {
                    const prev = cameFrom.get(curr);
                    const edge = this.graph.getEdge(prev, curr);
                    if (edge) distance += edge.weight;
                    
                    curr = prev;
                    path.unshift(curr);
                }

                return {
                    success: true,
                    path,
                    cost,
                    distance,
                    nodesExplored: closedSet.size,
                    explorationOrder,
                    closedSet: Array.from(closedSet),
                    openSet: Array.from(openSet),
                    gScore: Object.fromEntries(gScore),
                    fScore: Object.fromEntries(fScore)
                };
            }

            const neighbors = this.graph.getNeighbors(currentId);
            
            for (const neighbor of neighbors) {
                const neighborId = neighbor.node.id;
                if (closedSet.has(neighborId)) continue;

                const tentativeG = gScore.get(currentId) + neighbor.dynamicCost;

                if (tentativeG < gScore.get(neighborId)) {
                    cameFrom.set(neighborId, currentId);
                    gScore.set(neighborId, tentativeG);
                    
                    const h = useHeuristic ? this.euclideanDistance(neighbor.node, goalNode) : 0;
                    fScore.set(neighborId, tentativeG + h);
                    
                    openSet.add(neighborId);
                }
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
