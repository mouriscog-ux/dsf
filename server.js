const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Graph data of Liberdade neighbourhood for backend API
const LIBERDADE_NODES = [
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

const LIBERDADE_EDGES = [
  { from: 'N1', to: 'N4', weight: 80, street: 'R. Galvão Bueno' },
  { from: 'N4', to: 'N2', weight: 75, street: 'R. Galvão Bueno' },
  { from: 'N2', to: 'N3', weight: 130, street: 'Praça da Liberdade' },
  { from: 'N1', to: 'N5', weight: 170, street: 'R. Tomás de Lima' },
  { from: 'N5', to: 'N8', weight: 75, street: 'R. dos Estudantes' },
  { from: 'N8', to: 'N6', weight: 50, street: 'R. dos Estudantes' },
  { from: 'N6', to: 'N7', weight: 100, street: 'R. Américo de Campos' },
  { from: 'N2', to: 'N6', weight: 105, street: 'R. Galvão Bueno' },
  { from: 'N6', to: 'N9', weight: 90, street: 'R. Américo de Campos' },
  { from: 'N9', to: 'N7', weight: 95, street: 'R. da Glória' },
  { from: 'N3', to: 'N10', weight: 100, street: 'Av. Liberdade' },
  { from: 'N7', to: 'N10', weight: 130, street: 'Av. Liberdade' },
  { from: 'N7', to: 'N11', weight: 95, street: 'R. Cons. Furtado' },
  { from: 'N5', to: 'N12', weight: 85, street: 'R. São Joaquim' },
  { from: 'N8', to: 'N12', weight: 120, street: 'R. São Joaquim' }
];

// Helper: Euclidean distance heuristic h(n)
function heuristic(nodeA, nodeB) {
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Pathfinding implementation (A* vs Dijkstra)
function runPathfinding(startId, goalId, blockedIds = [], useHeuristic = true) {
  const nodesMap = new Map(LIBERDADE_NODES.map(n => [n.id, n]));
  const startNode = nodesMap.get(startId);
  const goalNode = nodesMap.get(goalId);

  if (!startNode || !goalNode) return null;

  const adj = new Map();
  LIBERDADE_NODES.forEach(n => adj.set(n.id, []));
  LIBERDADE_EDGES.forEach(e => {
    if (blockedIds.includes(e.from) || blockedIds.includes(e.to)) return;
    const nFrom = nodesMap.get(e.from);
    const nTo = nodesMap.get(e.to);
    if (nFrom.type === 'blocked' || nTo.type === 'blocked') return;

    adj.get(e.from).push({ node: e.to, weight: e.weight });
    adj.get(e.to).push({ node: e.from, weight: e.weight });
  });

  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();
  const openSet = new Set([startId]);
  const closedSet = new Set();
  const explorationOrder = [];

  LIBERDADE_NODES.forEach(n => {
    gScore.set(n.id, Infinity);
    fScore.set(n.id, Infinity);
  });

  gScore.set(startId, 0);
  const startH = useHeuristic ? heuristic(startNode, goalNode) : 0;
  fScore.set(startId, startH);

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
      // Reconstruct path
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

    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // API Endpoints
  if (parsedUrl.pathname === '/api/graph' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ nodes: LIBERDADE_NODES, edges: LIBERDADE_EDGES }));
    return;
  }

  if (parsedUrl.pathname === '/api/pathfind' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const startId = payload.startId || 'N1';
        const goalId = payload.goalId || 'N3';
        const blockedIds = payload.blockedIds || [];

        const startTimeA = process.hrtime();
        const astarResult = runPathfinding(startId, goalId, blockedIds, true);
        const diffA = process.hrtime(startTimeA);
        const timeAstarMs = (diffA[0] * 1000 + diffA[1] / 1e6).toFixed(3);

        const startTimeD = process.hrtime();
        const dijkstraResult = runPathfinding(startId, goalId, blockedIds, false);
        const diffD = process.hrtime(startTimeD);
        const timeDijkstraMs = (diffD[0] * 1000 + diffD[1] / 1e6).toFixed(3);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          astar: { ...astarResult, timeMs: timeAstarMs },
          dijkstra: { ...dijkstraResult, timeMs: timeDijkstraMs }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Server
  let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Recurso Não Encontrado');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Erro no Servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[SmartEvac] Servidor rodando em http://localhost:${PORT}`);
});
