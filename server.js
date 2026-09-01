const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

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

  const allEdges = Array.isArray(dynamicEdges) ? dynamicEdges : [];
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
async function fetchOSMData(south, west, north, east) {
  const query = `
    [out:json];

    (
      way["highway"](${south},${west},${north},${east});
      way["building"](${south},${west},${north},${east});
    );

    out geom;
  `;

  const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      body: query
    }
  );

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  return await response.json();
}

function processOSMData(data) {
  const roads = [];
  const buildings = [];

  for (const element of data.elements || []) {

    if (element.tags?.highway && element.geometry) {
      roads.push({
        id: `road_${element.id}`,
        type: element.tags.highway,
        name: element.tags.name || "Sem nome",
        geometry: element.geometry
      });
    }

    if (element.tags?.building && element.geometry) {
      buildings.push({
        id: `building_${element.id}`,
        type: element.tags.building,
        geometry: element.geometry
      });
    }
  }

  const graph = createGraphFromRoads(roads);

  return {
    roads,
    buildings,
    nodes: graph.nodes,
    edges: graph.edges
  };
}


function createGraphFromRoads(roads) {
  const nodes = [];
  const edges = [];

  const nodeMap = new Map();

  function getNodeId(lat, lng) {
    return `node_${lat.toFixed(7)}_${lng.toFixed(7)}`;
  }

  function getOrCreateNode(lat, lng) {
    const id = getNodeId(lat, lng);

    if (!nodeMap.has(id)) {
      const node = {
        id,
        lat,
        lng,
        type: "road"
      };

      nodeMap.set(id, node);
      nodes.push(node);
    }

    return nodeMap.get(id);
  }

  function distanceBetween(a, b) {
    const R = 6371000;

    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  for (const road of roads) {

    if (!road.geometry || road.geometry.length < 2) {
      continue;
    }

    for (let i = 0; i < road.geometry.length - 1; i++) {

      const pointA = road.geometry[i];
      const pointB = road.geometry[i + 1];

      const nodeA = getOrCreateNode(
        pointA.lat,
        pointA.lon
      );

      const nodeB = getOrCreateNode(
        pointB.lat,
        pointB.lon
      );

      const weight = distanceBetween(
        nodeA,
        nodeB
      );

      edges.push({
        from: nodeA.id,
        to: nodeB.id,
        weight
      });

      if (road.type !== "motorway") {
        edges.push({
          from: nodeB.id,
          to: nodeA.id,
          weight
        });
      }
    }
  }

  return {
    nodes,
    edges
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

const server = http.createServer(async (req, res) => {
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
    try {
  
      const south = parseFloat(
        parsedUrl.searchParams.get('south')
      );
  
      const west = parseFloat(
        parsedUrl.searchParams.get('west')
      );
  
      const north = parseFloat(
        parsedUrl.searchParams.get('north')
      );
  
      const east = parseFloat(
        parsedUrl.searchParams.get('east')
      );
  
      if (
        !Number.isFinite(south) ||
        !Number.isFinite(west) ||
        !Number.isFinite(north) ||
        !Number.isFinite(east)
      ) {
        res.writeHead(400, {
          'Content-Type': 'application/json'
        });
  
        res.end(JSON.stringify({
          error: 'Bounding box inválido'
        }));
  
        return;
      }
  
      const osmData = await fetchOSMData(
        south,
        west,
        north,
        east
      );
  
      const mapData = processOSMData(osmData);
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
  
      res.end(JSON.stringify(mapData));
  
    } catch (error) {
  
      console.error('Erro ao consultar OSM:', error);
  
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
  
      res.end(JSON.stringify({
        error: 'Erro ao consultar OpenStreetMap',
        message: error.message
      }));
    }
  
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

