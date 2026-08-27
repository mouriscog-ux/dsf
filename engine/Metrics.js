export class Metrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.totalTime = 0;
        this.totalDistance = 0;
        this.totalCost = 0;
        this.nodesExplored = 0;
        this.evacuatedCount = 0;
        this.atRiskCount = 0;
        this.logs = [];
    }

    addLog(message) {
        const timeStr = new Date().toISOString().substring(11, 19); // HH:MM:SS
        const logStr = `[${timeStr}] ${message}`;
        this.logs.push(logStr);
        return logStr;
    }

    addPathMetrics(pathResult) {
        if (pathResult && pathResult.success) {
            this.totalCost += pathResult.cost;
            this.totalDistance += pathResult.distance;
            this.nodesExplored += pathResult.nodesExplored;
        }
    }

    getSummary(useAI) {
        let reason = '';
        if (useAI) {
            reason = 'Tempo otimizado porque os agentes foram distribuídos entre várias saídas, evitando superlotação, e as rotas evitaram áreas de risco/congestionamento.';
        } else {
            reason = 'Maior congestionamento e potencial gargalo nas saídas, pois a maioria dos agentes escolheu a saída mais próxima (menor distância), ignorando a capacidade e riscos.';
        }

        return {
            totalTime: this.totalTime,
            totalDistance: this.totalDistance,
            totalCost: this.totalCost,
            nodesExplored: this.nodesExplored,
            evacuatedCount: this.evacuatedCount,
            atRiskCount: this.atRiskCount,
            reason: reason,
            logs: this.logs
        };
    }
}
