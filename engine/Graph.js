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

        const nodes = this.map.getNodes();
        const edges = this.map.getEdges();

        nodes.forEach(n => {
            this.nodesMap.set(n.id, n);
            this.adjList.set(n.id, []);
        });

        edges.forEach(e => {
            // Initializing dynamic properties if not present
            e.riskLevel = e.riskLevel || 0; // 0 to 100
            e.congestion = e.congestion || 0; // number of agents on this edge
            e.blocked = e.blocked || false;

            this.adjList.get(e.from).push(e);
            // Assuming undirected graph based on initial code
            this.adjList.get(e.to).push({ ...e, from: e.to, to: e.from }); 
        });
    }

    getEdge(fromId, toId) {
        const edges = this.adjList.get(fromId);
        if (!edges) return null;
        return edges.find(e => e.to === toId);
    }

    getNeighbors(nodeId) {
        const neighbors = this.adjList.get(nodeId) || [];
        return neighbors.map(edge => {
            const node = this.nodesMap.get(edge.to);
            return {
                node,
                edge,
                dynamicCost: this.calculateDynamicCost(edge)
            };
        }).filter(n => n.node && n.node.type !== 'blocked' && !n.edge.blocked);
    }

    calculateDynamicCost(edge) {
        if (edge.blocked) return Infinity;

        let cost = edge.weight; // distance

        // Risk penalty
        if (edge.riskLevel > 0) {
            cost += edge.riskLevel * 2; // Arbitrary multiplier for risk
        }

        // Congestion penalty
        if (edge.congestion >= 16) {
            cost += 100;
        } else if (edge.congestion >= 6) {
            cost += 30;
        }

        return cost;
    }

    blockNode(nodeId) {
        const node = this.nodesMap.get(nodeId);
        if (node) node.type = 'blocked';
    }

    blockEdge(fromId, toId) {
        // find edge in map.edges to update global state
        const edge = this.map.getEdges().find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId));
        if (edge) edge.blocked = true;
        this.build();
    }
    
    updateCongestion(fromId, toId, change) {
        const edge = this.map.getEdges().find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId));
        if (edge) {
            edge.congestion = Math.max(0, (edge.congestion || 0) + change);
        }
        this.build();
    }
}
