export class AI {
    constructor(graph, routing) {
        this.graph = graph;
        this.routing = routing;
        this.exits = [];
        this.initializeExits();
    }

    initializeExits() {
        this.exits = Array.from(this.graph.nodesMap.values())
            .filter(n => n.type === 'exit')
            .map(n => ({
                id: n.id,
                node: n,
                maxCapacity: 100, // configurable
                currentOccupancy: 0,
                status: 'open'
            }));
    }

    getExits() {
        return this.exits;
    }

    chooseBestExit(startId, includeAIParams) {
        if (!includeAIParams) {
            // Simple logic: closest exit by Euclidean distance
            let bestExit = null;
            let minDistance = Infinity;
            const startNode = this.graph.nodesMap.get(startId);

            for (const exit of this.exits) {
                const dist = this.routing.euclideanDistance(startNode, exit.node);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestExit = exit;
                }
            }
            return bestExit ? bestExit.id : null;
        }

        // AI logic: Evaluate exits based on score
        // score = distance + risk + congestion + capacity penalty
        let bestExitId = null;
        let bestScore = Infinity;

        for (const exit of this.exits) {
            if (exit.status === 'full') continue;

            // Get path to exit using A*
            const pathResult = this.routing.findPathAStar(startId, exit.id);
            if (!pathResult.success) continue;

            let score = pathResult.cost; // cost already includes distance + edge risk + edge congestion

            // Capacity penalty: increase score as it gets fuller
            const occupancyRatio = exit.currentOccupancy / exit.maxCapacity;
            if (occupancyRatio > 0.8) {
                score += 200 * occupancyRatio; 
            }
            
            if (occupancyRatio >= 1) {
                exit.status = 'full';
                continue;
            }

            if (score < bestScore) {
                bestScore = score;
                bestExitId = exit.id;
            }
        }

        return bestExitId;
    }

    recordArrival(exitId) {
        const exit = this.exits.find(e => e.id === exitId);
        if (exit) {
            exit.currentOccupancy++;
            if (exit.currentOccupancy >= exit.maxCapacity) {
                exit.status = 'full';
            }
        }
    }
    
    reset() {
        this.initializeExits();
    }
}
