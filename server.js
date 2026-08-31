const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Graph data of Liberdade neighbourhood for backend API (Real Leaflet/OpenStreetMap street coordinates)
const LIBERDADE_NODES = [
  { id: 'N1', name: 'Rua Galvão Bueno (Norte)', lat: -23.5546, lng: -46.6353, x: 60, y: 90, type: 'normal' },
  { id: 'N2', name: 'Cruzamento Galvão x Estudantes', lat: -23.5558, lng: -46.6349, x: 210, y: 95, type: 'normal' },
  { id: 'N3', name: 'Saída Metrô Liberdade 🚇', lat: -23.5550, lng: -46.6358, x: 340, y: 70, type: 'exit' },
  { id: 'N4', name: 'Viaduto Cidade de Osaka 🌉', lat: -23.5552, lng: -46.6351, x: 140, y: 60, type: 'blocked' },
  { id: 'N5', name: 'Rua dos Estudantes (Oeste)', lat: -23.5560, lng: -46.6362, x: 90, y: 260, type: 'normal' },
  { id: 'N6', name: 'Cruzamento Estudantes x Américo', lat: -23.5566, lng: -46.6342, x: 200, y: 200, type: 'normal' },
  { id: 'N7', name: 'Praça da Liberdade 🏙️', lat: -23.5558, lng: -46.6364, x: 300, y: 180, type: 'exit' },
  { id: 'N8', name: 'Rua da Glória (Sul)', lat: -23.5572, lng: -46.6346, x: 160, y: 230, type: 'normal' },
  { id: 'N9', name: 'Rua Américo de Campos', lat: -23.5570, lng: -46.6334, x: 270, y: 270, type: 'normal' },
  { id: 'N10', name: 'Avenida Liberdade 🚦', lat: -23.5582, lng: -46.6366, x: 420, y: 130, type: 'exit' },
  { id: 'N11', name: 'Rua Conselheiro Furtado', lat: -23.5568, lng: -46.6322, x: 380, y: 230, type: 'normal' },
  { id: 'N12', name: 'Rua São Joaquim', lat: -23.5586, lng: -46.6352, x: 110, y: 340, type: 'normal' }
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

// Helper: Euclidean distance heuristic h(n) using real GPS coordinates
function heuristicToNode(nodeA, nodeB) {
  if (nodeA.lat !== undefined && nodeB.lat !== undefined) {
    const dLat = (nodeA.lat - nodeB.lat) * 111320;
    const dLng = (nodeA.lng - nodeB.lng) * 111320 * Math.cos(nodeA.lat * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateHeuristic(node, exitNodes, goalNode, useHeuristic) {
  if (!useHeuristic) return 0;
  if (goalNode) return heuristicToNode(node, goalNode);
  if (!exitNodes || exitNodes.length === 0) return 0;
  
  let minH = Infinity;
  for (const exit of exitNodes) {
    const h = heuristicToNode(node, exit);
    if (h < minH) minH = h;
  }
  return minH === Infinity ? 0 : minH;
}

// Build adjacency graph merging static and dynamic nodes/edges
function buildGraph(dynamicNodes = [], dynamicEdges = [], blockedIds = []) {
  const nodesMap = new Map();
  LIBERDADE_NODES.forEach(n => nodesMap.set(n.id, { ...n }));
  if (Array.isArray(dynamicNodes)) {
    dynamicNodes.forEach(n => {
      if (n && n.id) nodesMap.set(n.id, { ...n });
    });
  }

  const blockedSet = new Set(blockedIds || []);
  const allNodes = Array.from(nodesMap.values());
  const exitNodes = allNodes.filter(n => n.type === 'exit' && !blockedSet.has(n.id));

  const adj = new Map();
  allNodes.forEach(n => adj.set(n.id, []));

  const allEdges = [...LIBERDADE_EDGES, ...(Array.isArray(dynamicEdges) ? dynamicEdges : [])];
  allEdges.forEach(e => {
    if (!e || !e.from || !e.to) return;
    if (blockedSet.has(e.from) || blockedSet.has(e.to)) return;
    const nFrom = nodesMap.get(e.from);
    const nTo = nodesMap.get(e.to);
    if (!nFrom || !nTo || nFrom.type === 'blocked' || nTo.type === 'blocked') return;

    adj.get(e.from).push({ node: e.to, weight: e.weight });
    adj.get(e.to).push({ node: e.from, weight: e.weight });
  });

  return { nodesMap, adj, exitNodes, allNodes };
}

// Pathfinding implementation (A* vs Dijkstra with dynamic nodes & multi-exit support)
function runPathfindingOnGraph(graph, startId, goalId = null, useHeuristic = true, blockedIds = []) {
  const { nodesMap, adj, exitNodes, allNodes } = graph;
  const startNode = nodesMap.get(startId);
  const blockedSet = new Set(blockedIds || []);

  if (!startNode || startNode.type === 'blocked' || blockedSet.has(startId)) {
    return null;
  }

  const goalNode = goalId ? nodesMap.get(goalId) : null;
  if (goalId && (!goalNode || goalNode.type === 'blocked' || blockedSet.has(goalId))) {
    return null;
  }

  if (!goalNode && exitNodes.length === 0) {
    return null;
  }

  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();
  const openSet = new Set([startId]);
  const closedSet = new Set();
  const explorationOrder = [];

  allNodes.forEach(n => {
    gScore.set(n.id, Infinity);
    fScore.set(n.id, Infinity);
  });

  gScore.set(startId, 0);
  const startH = calculateHeuristic(startNode, exitNodes, goalNode, useHeuristic);
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

    const currNode = nodesMap.get(current);

    // Goal condition: specific goal or reaching any exit node
    const isGoalReached = goalNode ? (current === goalId) : (currNode && currNode.type === 'exit');
    if (isGoalReached) {
      const path = [current];
      let curr = current;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        path.unshift(curr);
      }
      return {
        success: true,
        path,
        cost: gScore.get(current),
        nodesExplored: closedSet.size,
        explorationOrder,
        closedSet: Array.from(closedSet),
        openSet: Array.from(openSet),
        destinationExit: currNode
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
        const nbNode = nodesMap.get(neighborId);
        const h = calculateHeuristic(nbNode, exitNodes, goalNode, useHeuristic);
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
    openSet: Array.from(openSet),
    destinationExit: null
  };
}

function runPathfinding(startId, goalId = null, blockedIds = [], useHeuristic = true, dynamicNodes = [], dynamicEdges = []) {
  const graph = buildGraph(dynamicNodes, dynamicEdges, blockedIds);
  return runPathfindingOnGraph(graph, startId, goalId, useHeuristic, blockedIds);
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

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

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
        const goalId = payload.goalId || null;
        const blockedIds = payload.blockedIds || [];
        const dynamicNodes = payload.dynamicNodes || [];
        const dynamicEdges = payload.dynamicEdges || [];

        const startTimeA = process.hrtime();
        const astarResult = runPathfinding(startId, goalId, blockedIds, true, dynamicNodes, dynamicEdges);
        const diffA = process.hrtime(startTimeA);
        const timeAstarMs = (diffA[0] * 1000 + diffA[1] / 1e6).toFixed(3);

        const startTimeD = process.hrtime();
        const dijkstraResult = runPathfinding(startId, goalId, blockedIds, false, dynamicNodes, dynamicEdges);
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

  if (parsedUrl.pathname === '/api/pathfind-batch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const agentsList = Array.isArray(payload.agents) ? payload.agents : [];
        const blockedIds = payload.blockedIds || [];
        const dynamicNodes = payload.dynamicNodes || [];
        const dynamicEdges = payload.dynamicEdges || [];
        const useHeuristic = payload.useHeuristic !== undefined ? payload.useHeuristic : true;

        const startTime = process.hrtime();
        const graph = buildGraph(dynamicNodes, dynamicEdges, blockedIds);
        
        const results = {};
        let totalExplored = 0;
        let totalCost = 0;
        let validCount = 0;

        for (const ag of agentsList) {
          const resPath = runPathfindingOnGraph(
            graph,
            ag.startId || 'N1',
            ag.goalId || null,
            useHeuristic,
            blockedIds
          );
          if (resPath) {
            results[ag.id] = resPath;
            if (resPath.success) {
              totalExplored += resPath.nodesExplored;
              totalCost += resPath.cost;
              validCount++;
            }
          }
        }

        const diff = process.hrtime(startTime);
        const totalTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          results,
          summary: {
            totalAgents: agentsList.length,
            validAgents: validCount,
            avgNodesExplored: validCount > 0 ? (totalExplored / validCount).toFixed(1) : 0,
            avgCost: validCount > 0 ? (totalCost / validCount).toFixed(1) : 0,
            totalTimeMs
          }
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
