const NODES = [
  { id: 'N1', name: 'Rua Galvão Bueno (Norte)', x: 60, y: 90, type: 'normal' },
  { id: 'N2', name: 'Cruzamento Galvão x Estudantes', x: 210, y: 95, type: 'normal' },
  { id: 'N3', name: 'Saída Metrô Liberdade', x: 340, y: 70, type: 'exit' },
  { id: 'N4', name: 'Viaduto Cidade de Osaka', x: 140, y: 60, type: 'blocked' },
  { id: 'N5', name: 'Rua dos Estudantes (Oeste)', x: 90, y: 260, type: 'normal' },
  { id: 'N6', name: 'Cruzamento Estudantes x Américo', x: 200, y: 200, type: 'normal' },
  { id: 'N7', name: 'Saída Praça da Liberdade', x: 300, y: 180, type: 'exit' },
  { id: 'N8', name: 'Rua Glória (Sul)', x: 160, y: 230, type: 'normal' },
  { id: 'N9', name: 'Rua Américo de Campos', x: 270, y: 270, type: 'normal' },
  { id: 'N10', name: 'Saída Avenida Liberdade', x: 420, y: 130, type: 'exit' },
  { id: 'N11', name: 'Rua Conselheiro Furtado', x: 380, y: 230, type: 'normal' },
  { id: 'N12', name: 'Rua São Joaquim', x: 110, y: 340, type: 'normal' }
];

const EDGES = [
  { from: 'N1', to: 'N4', weight: 80 },
  { from: 'N4', to: 'N2', weight: 75 },
  { from: 'N2', to: 'N3', weight: 130 },
  { from: 'N1', to: 'N5', weight: 170 },
  { from: 'N5', to: 'N8', weight: 75 },
  { from: 'N8', to: 'N6', weight: 50 },
  { from: 'N6', to: 'N7', weight: 100 },
  { from: 'N2', to: 'N6', weight: 105 },
  { from: 'N6', to: 'N9', weight: 90 },
  { from: 'N9', to: 'N7', weight: 95 },
  { from: 'N3', to: 'N10', weight: 100 },
  { from: 'N7', to: 'N10', weight: 130 },
  { from: 'N7', to: 'N11', weight: 95 },
  { from: 'N5', to: 'N12', weight: 85 },
  { from: 'N8', to: 'N12', weight: 120 }
];

function heuristic(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function runPathfinding(startId, goalId, blockedIds = [], useHeuristic = true) {
  const nodesMap = new Map(NODES.map(n => [n.id, n]));
  const startNode = nodesMap.get(startId);
  const goalNode = nodesMap.get(goalId);
  if (!startNode || !goalNode) return null;

  const blocked = new Set(blockedIds);
  const adj = new Map();
  NODES.forEach(n => adj.set(n.id, []));

  EDGES.forEach(e => {
    if (blocked.has(e.from) || blocked.has(e.to)) return;
    const from = nodesMap.get(e.from);
    const to = nodesMap.get(e.to);
    if (from.type === 'blocked' || to.type === 'blocked') return;
    adj.get(e.from).push({ node: e.to, weight: e.weight });
    adj.get(e.to).push({ node: e.from, weight: e.weight });
  });

  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();
  const openSet = new Set([startId]);
  const closedSet = new Set();
  const explorationOrder = [];

  NODES.forEach(n => {
    gScore.set(n.id, Infinity);
    fScore.set(n.id, Infinity);
  });

  gScore.set(startId, 0);
  fScore.set(startId, useHeuristic ? heuristic(startNode, goalNode) : 0);

  while (openSet.size > 0) {
    let current = null;
    let lowestF = Infinity;

    for (const nodeId of openSet) {
      if (fScore.get(nodeId) < lowestF) {
        lowestF = fScore.get(nodeId);
        current = nodeId;
      }
    }

    if (!current) break;
    openSet.delete(current);
    closedSet.add(current);
    explorationOrder.push(current);

    if (current === goalId) {
      const path = [current];
      let curr = current;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        path.unshift(curr);
      }
      return {
        success: true,
        path,
        cost: gScore.get(goalId),
        nodesExplored: closedSet.size,
        explorationOrder,
        closedSet: Array.from(closedSet),
        openSet: Array.from(openSet)
      };
    }

    for (const neighbor of (adj.get(current) || [])) {
      const neighborId = neighbor.node;
      if (closedSet.has(neighborId)) continue;

      const tentativeG = gScore.get(current) + neighbor.weight;
      if (tentativeG < gScore.get(neighborId)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        const h = useHeuristic ? heuristic(nodesMap.get(neighborId), goalNode) : 0;
        fScore.set(neighborId, tentativeG + h);
        openSet.add(neighborId);
      }
    }
  }

  return {
    success: false,
    path: [],
    cost: Infinity,
    nodesExplored: closedSet.size,
    explorationOrder,
    closedSet: Array.from(closedSet),
    openSet: Array.from(openSet)
  };
}

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ error: 'Método não permitido' }));
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });

  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const startId = payload.startId || 'N1';
      const goalId = payload.goalId || 'N3';
      const blockedIds = Array.isArray(payload.blockedIds) ? payload.blockedIds : [];

      const startTimeA = process.hrtime();
      const astarResult = runPathfinding(startId, goalId, blockedIds, true);
      const diffA = process.hrtime(startTimeA);
      const timeAstarMs = (diffA[0] * 1000 + diffA[1] / 1e6).toFixed(3);

      const startTimeD = process.hrtime();
      const dijkstraResult = runPathfinding(startId, goalId, blockedIds, false);
      const diffD = process.hrtime(startTimeD);
      const timeDijkstraMs = (diffD[0] * 1000 + diffD[1] / 1e6).toFixed(3);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        astar: { ...astarResult, timeMs: timeAstarMs },
        dijkstra: { ...dijkstraResult, timeMs: timeDijkstraMs }
      }));
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
