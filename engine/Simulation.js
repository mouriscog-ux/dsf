import { SimMap } from './Map.js';
import { Graph } from './Graph.js';
import { Routing } from './Routing.js';
import { AI } from './AI.js';
import { Agent } from './Agents.js';
import { Metrics } from './Metrics.js';
import { Random } from './utils.js';

export class Simulation {
    constructor() {
        this.map = new SimMap();
        this.graph = new Graph(this.map);
        this.routing = new Routing(this.graph);
        this.ai = new AI(this.graph, this.routing);
        this.metrics = new Metrics();
        
        this.agents = [];
        this.state = 'stopped'; // 'stopped', 'running', 'paused'
        this.useAI = false;
        this.timeStep = 0.25; // segment progress per tick
        this.seed = 12345;
    }

    iniciarSimulacao(config) {
        if (this.state === 'running') return;
        if (this.state === 'paused') {
            this.state = 'running';
            return;
        }

        const totalAgents = config.agentsCount || 50;
        this.useAI = config.useAI || false;
        this.seed = config.seed || 12345;
        this.metrics.reset();
        this.ai.reset();
        
        const rng = new Random(this.seed);
        const normalNodes = this.map.getNodes().filter(n => n.type === 'normal');

        this.agents = [];
        for (let i = 1; i <= totalAgents; i++) {
            const startNode = normalNodes[rng.nextInt(0, normalNodes.length)];
            const agent = new Agent(i, startNode.id, this.map);
            this.agents.push(agent);
        }

        this.metrics.addLog(`Simulação iniciada — ${totalAgents} agentes (IA: ${this.useAI})`);
        
        this.planAllAgents();
        this.state = 'running';
    }

    pausarSimulacao() {
        this.state = 'paused';
    }

    reiniciarSimulacao() {
        this.state = 'stopped';
        this.map.reset();
        this.graph.build();
        this.ai.reset();
        this.metrics.reset();
        this.agents = [];
    }

    planAllAgents() {
        for (const agent of this.agents) {
            if (agent.evacuated) continue;
            this._planAgent(agent);
        }
    }

    _planAgent(agent) {
        const bestExitId = this.ai.chooseBestExit(agent.currentNodeId, this.useAI);
        if (bestExitId) {
            const pathRes = this.routing.findPathAStar(agent.currentNodeId, bestExitId);
            agent.setPath(pathRes, bestExitId);
            this.metrics.addPathMetrics(pathRes);
        }
    }

    bloquearAresta(fromId, toId) {
        this.graph.blockEdge(fromId, toId);
        this.metrics.addLog(`Bloqueio detectado na rota ${fromId}-${toId}.`);
        this._replanDueToEvent();
    }

    _replanDueToEvent() {
        if (!this.useAI) return;
        this.metrics.addLog(`A* recalculando caminhos devido a evento importante.`);
        let redirected = 0;
        for (const agent of this.agents) {
            if (agent.evacuated) continue;
            this._planAgent(agent);
            redirected++;
        }
        if (redirected > 0) {
            this.metrics.addLog(`${redirected} agentes redirecionados.`);
        }
    }

    update() {
        if (this.state !== 'running') return;
        this.metrics.totalTime += 1; // Assuming 1 tick = 1 sec simulation time

        let allEvacuated = true;
        
        // Reset edge congestion before calculating for this tick
        this.map.getEdges().forEach(e => e.congestion = 0);
        this.graph.build(); // apply reset

        for (const agent of this.agents) {
            if (agent.evacuated) continue;
            allEvacuated = false;

            // Move agent
            agent.segmentProgress += this.timeStep * agent.speed;
            
            const edgeCurrent = agent.updatePosition(this.map);
            if (edgeCurrent) {
                // Update congestion dynamically
                this.graph.updateCongestion(edgeCurrent.fromId, edgeCurrent.toId, 1);
            }

            if (agent.segmentProgress >= 1) {
                agent.segmentProgress = 0;
                agent.pathIndex++;
                agent.currentNodeId = agent.path[agent.pathIndex];

                const currNode = this.map.getNode(agent.currentNodeId);
                if (currNode && currNode.type === 'exit') {
                    agent.evacuated = true;
                    this.metrics.evacuatedCount++;
                    this.ai.recordArrival(currNode.id);
                    this.metrics.addLog(`Agente ${agent.id} evacuou via ${currNode.name}`);
                }
            }
        }

        if (allEvacuated) {
            this.state = 'stopped';
            this.metrics.addLog(`Todos os agentes evacuados.`);
        }
    }

    getAgents() {
        return this.agents;
    }

    getMetrics() {
        return this.metrics.getSummary(this.useAI);
    }
}
