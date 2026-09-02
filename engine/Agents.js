export class Agent {
    constructor(id, startNodeId, map) {
        this.id = id;
        this.currentNodeId = startNodeId;
        this.targetExitId = null;
        this.path = [];
        this.pathIndex = 0;
        this.segmentProgress = 0;
        
        const startNode = map.getNode(startNodeId);
        this.x = startNode ? startNode.x : 0;
        this.y = startNode ? startNode.y : 0;
        
        this.speed = 1.0;
        this.evacuated = false;
        this.state = 'waiting';
    }

    setPath(pathResult, exitId) {
        if (pathResult && pathResult.success) {
            this.path = pathResult.path;
            this.targetExitId = exitId;
            this.pathIndex = 0;
            this.segmentProgress = 0;
            this.state = 'moving';
        } else {
            this.state = 'stuck';
            this.path = [];
        }
    }

    updatePosition(map) {
        if (this.evacuated || this.path.length <= 1) return null;
        if (this.pathIndex >= this.path.length - 1) return null;

        const fromId = this.path[this.pathIndex];
        const toId = this.path[this.pathIndex + 1];

        const nFrom = map.getNode(fromId);
        const nTo = map.getNode(toId);

        if (nFrom && nTo) {
            this.x = nFrom.x + (nTo.x - nFrom.x) * this.segmentProgress;
            this.y = nFrom.y + (nTo.y - nFrom.y) * this.segmentProgress;
        }

        return { fromId, toId }; // To know which edge the agent is currently on
    }
}
