import { SimMap } from './engine/Map.js';
import { Graph } from './engine/Graph.js';
import { Routing } from './engine/Routing.js';

const mapModel = new SimMap();
let graph = new Graph(mapModel);
let routing = new Routing(graph);

const MODEL_BOUNDS = { minX: 40, maxX: 440, minY: 40, maxY: 400 };
const GEO_BOUNDS = { south: -23.5600, north: -23.5540, west: -46.6400, east: -46.6320 };
const AGENT_STATES = { IDLE: 'IDLE', MOVING: 'MOVING', WAITING: 'WAITING', BLOCKED: 'BLOCKED', EVACUATED: 'EVACUATED' };

let agents = [];
let nextAgentId = 1;
let state = 'stopped';
let speed = 1.5;
let selectedEdgeId = 'BE';
let fireEdgeId = 'BE';
let activeTab = 'tab-mapa';
let elapsedSeconds = 0;
let timer = null;
let lastFrame = 0;
let lastPathResult = null;
let dijkstraResult = null;
let activeTool = null;
let selectedAgentId = null;
let recalculationCount = 0;

const qs = (id) => document.getElementById(id);
const statusDot = qs('status-dot');
const statusText = qs('status-text');
const logList = qs('log-list');
const statEvacuados = qs('stat-evacuados');
const statTotal = qs('stat-total');
const statTempo = qs('stat-tempo');
const statNos = qs('stat-nos');
const statCusto = qs('stat-custo');
const statFireAstar = qs('stat-fire-astar');
const statFireDijkstra = qs('stat-fire-dijkstra');
const fieldAgentes = qs('field-agentes');
const mapToolbar = qs('map-toolbar');
const overlayContainer = qs('overlay-container');
const mapCanvas = qs('map-canvas');
const speedLabel = qs('speed-label');
const speedFill = qs('speed-fill');
const speedThumb = qs('speed-thumb');
const speedTrack = qs('speed-track');
const evacLine = qs('evac-line');
const evacArea = qs('evac-area');
const chartXStart = qs('chart-x-start');
const chartXMid = qs('chart-x-mid');
const chartXEnd = qs('chart-x-end');

function xyToLatLng(x, y) {
  const lng = GEO_BOUNDS.west + (x - MODEL_BOUNDS.minX) / (MODEL_BOUNDS.maxX - MODEL_BOUNDS.minX) * (GEO_BOUNDS.east - GEO_BOUNDS.west);
  const lat = GEO_BOUNDS.north - (y - MODEL_BOUNDS.minY) / (MODEL_BOUNDS.maxY - MODEL_BOUNDS.minY) * (GEO_BOUNDS.north - GEO_BOUNDS.south);
  return { lat, lng };
}

function latLngToXY(lat, lng) {
  return {
    x: MODEL_BOUNDS.minX + (lng - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west) * (MODEL_BOUNDS.maxX - MODEL_BOUNDS.minX),
    y: MODEL_BOUNDS.minY + (GEO_BOUNDS.north - lat) / (GEO_BOUNDS.north - GEO_BOUNDS.south) * (MODEL_BOUNDS.maxY - MODEL_BOUNDS.minY)
  };
}

function nodeLatLng(node) { return xyToLatLng(node.x, node.y); }
function edgeLatLngs(edge) { return mapModel.getEdgeGeometry(edge).map(p => xyToLatLng(p.x, p.y)); }
function getNode(id) { return mapModel.getNode(id); }
function getExitId() { return mapModel.getNodes().find(n => n.type === 'exit')?.id || 'I'; }
function rebuildGraph() { graph = new Graph(mapModel); routing = new Routing(graph); }

function addLog(message) {
  const line = document.createElement('div');
  line.innerHTML = '&gt; ' + message;
  logList.prepend(line);
  while (logList.children.length > 9) logList.lastChild.remove();
}

function setStatus(next) {
  state = next;
  statusDot.className = 'dot ' + (next === 'running' ? 'running' : next === 'paused' ? 'paused' : 'stopped');
  statusText.textContent = next === 'running' ? 'Simulação em execução' : next === 'paused' ? 'Simulação pausada' : 'Simulação parada';
}

function distanceAlong(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total || 1;
}

function closestPointOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + dx * t, y: a.y + dy * t, t, distance: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)) };
}

function snapToRoad(xy) {
  let best = null;
  for (const edge of mapModel.getEdges()) {
    const points = mapModel.getEdgeGeometry(edge);
    for (let i = 1; i < points.length; i++) {
      const projected = closestPointOnSegment(xy, points[i - 1], points[i]);
      if (!best || projected.distance < best.distance) {
        const fromNode = getNode(edge.from);
        const toNode = getNode(edge.to);
        const fromDistance = Math.hypot(projected.x - fromNode.x, projected.y - fromNode.y);
        const toDistance = Math.hypot(projected.x - toNode.x, projected.y - toNode.y);
        best = { edge, point: { x: projected.x, y: projected.y }, distance: projected.distance, nearestNode: fromDistance <= toDistance ? edge.from : edge.to };
      }
    }
  }
  return best;
}

function orientedGeometry(edge, fromId) {
  const points = mapModel.getEdgeGeometry(edge).map(p => ({ ...p }));
  return edge.from === fromId ? points : points.reverse();
}

function buildTrack(agent, path) {
  const track = [{ ...agent.originPoint }];
  for (let i = 1; i < path.length; i++) {
    const edge = mapModel.getEdge(path[i - 1], path[i]);
    if (!edge) continue;
    const points = orientedGeometry(edge, path[i - 1]);
    for (const point of points) {
      const previous = track[track.length - 1];
      if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.5) track.push({ ...point });
    }
  }
  const last = track[track.length - 1];
  if (agent.destinationPoint && (!last || Math.hypot(last.x - agent.destinationPoint.x, last.y - agent.destinationPoint.y) > 0.5)) {
    track.push({ ...agent.destinationPoint });
  }
  return track;
}

function pointOnTrack(points, distance) {
  const total = distanceAlong(points);
  const target = Math.max(0, Math.min(total, distance));
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if (walked + len >= target) {
      const t = (target - walked) / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += len;
  }
  return points[points.length - 1] || { x: 0, y: 0 };
}

function pointAtProgress(edge, progress, fromId) {
  let points = mapModel.getEdgeGeometry(edge).map(p => ({ ...p }));
  if (edge.to === fromId) points = points.reverse();
  const target = Math.max(0, Math.min(1, progress)) * distanceAlong(points);
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if (walked + len >= target) {
      const t = (target - walked) / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += len;
  }
  return points[points.length - 1];
}

function bestPath(startNodeId, destinationNodeId = getExitId(), algorithm = 'astar') {
  const result = algorithm === 'dijkstra'
    ? routing.findPathDijkstra(startNodeId, destinationNodeId)
    : routing.findPathAStar(startNodeId, destinationNodeId);
  return result && result.success ? result : null;
}

function routeEdges(path) {
  const edges = [];
  for (let i = 1; i < path.length; i++) {
    const edge = mapModel.getEdge(path[i - 1], path[i]);
    if (edge) edges.push(edge);
  }
  return edges;
}

function isPathValid(agent) {
  if (!agent.route || agent.route.length < 2) return false;
  for (let i = agent.routeIndex + 1; i < agent.route.length; i++) {
    const edge = mapModel.getEdge(agent.route[i - 1], agent.route[i]);
    if (!edge || edge.blocked) return false;
  }
  return true;
}

function planAgent(agent, announce = false) {
  const result = bestPath(agent.currentNode, agent.destinationNode, 'astar');
  lastPathResult = result;
  dijkstraResult = bestPath(agent.currentNode, agent.destinationNode, 'dijkstra');
  if (!result) {
    agent.state = AGENT_STATES.BLOCKED;
    agent.route = [agent.currentNode];
    agent.routeIndex = 0;
    agent.segmentProgress = 0;
    agent.track = [{ x: agent.x, y: agent.y }];
    agent.trackProgress = 0;
    if (announce) addLog('<span class="warn">rota impossível para agente ' + agent.id + '</span>');
    return false;
  }
  agent.route = result.path;
  agent.routeIndex = 0;
  agent.segmentProgress = 0;
  agent.track = buildTrack(agent, result.path);
  agent.trackProgress = 0;
  agent.state = AGENT_STATES.MOVING;
  if (announce) addLog('nova rota: ' + result.path.join(' → '));
  return true;
}

function addAgent(type = 'person', startNode = 'A', destinationNode = getExitId(), originPoint = null, destinationPoint = null) {
  const start = getNode(startNode) || getNode('A');
  const destination = getNode(destinationNode) || getNode(getExitId());
  const offset = 0;
  const agent = {
    id: nextAgentId++, type, currentNode: start.id, destinationNode: destination.id,
    route: [], routeIndex: 0, segmentProgress: 0, speed: type === 'car' ? 80 : 48 + (nextAgentId % 4) * 5,
    state: AGENT_STATES.IDLE, x: originPoint?.x ?? start.x, y: (originPoint?.y ?? start.y) + offset, offset,
    originPoint: originPoint ? { ...originPoint } : { x: start.x, y: start.y },
    destinationPoint: destinationPoint ? { ...destinationPoint } : { x: destination.x, y: destination.y },
    track: [], trackProgress: 0
  };
  agents.push(agent);
  planAgent(agent);
  updateStats();
  selectedAgentId = agent.id;
  addLog((type === 'car' ? 'carro' : 'pessoa') + ' ' + agent.id + ' adicionad' + (type === 'car' ? 'o' : 'a') + ' em ' + start.name);
  return agent;
}
window.addAgent = addAgent;

function replanAll(reason) {
  addLog('<span class="warn">rota atual invalidada</span>');
  addLog('calculando nova rota via A*...');
  let redirected = 0;
  for (const agent of agents) {
    if (agent.state === AGENT_STATES.EVACUATED) continue;
    if (planAgent(agent)) { redirected++; recalculationCount++; }
  }
  addLog(redirected ? 'agentes redirecionados: ' + redirected + ' (' + reason + ')' : '<span class="warn">nenhuma rota segura disponível</span>');
  renderAll();
}

function blockEdge(edgeId, reason = 'block') {
  const edge = mapModel.setEdgeBlocked(edgeId, true, reason);
  if (!edge) return;
  rebuildGraph();
  addLog('<span class="warn">' + (reason === 'fire' ? 'INCÊNDIO' : 'BLOQUEIO') + ' em ' + edge.name + ' (' + edge.from + '-' + edge.to + ')</span>');
  replanAll(edge.name);
}

function resetSimulation() {
  stopTimer();
  mapModel.reset();
  rebuildGraph();
  agents = [];
  nextAgentId = 1;
  elapsedSeconds = 0;
  selectedEdgeId = 'BE';
  fireEdgeId = 'BE';
  lastPathResult = null;
  dijkstraResult = null;
  activeTool = null;
  selectedAgentId = null;
  recalculationCount = 0;
  logList.innerHTML = '';
  addAgent('person', 'A', 'I');
  addAgent('person', 'D', 'I');
  addAgent('person', 'G', 'I');
  addAgent('car', 'B', 'I');
  setStatus('stopped');
  addLog('grafo real A-I carregado: ruas, nós, arestas e saída segura');
  updateChart(true);
  renderAll();
}

const leafletMap = L.map('leaflet-map', {
  center: [(GEO_BOUNDS.north + GEO_BOUNDS.south) / 2, (GEO_BOUNDS.west + GEO_BOUNDS.east) / 2],
  zoom: 16,
  minZoom: 15,
  maxZoom: 19
});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);

const streetsLayer = L.layerGroup().addTo(leafletMap);
const routesLayer = L.layerGroup().addTo(leafletMap);
const nodesLayer = L.layerGroup().addTo(leafletMap);
const agentsLayer = L.layerGroup().addTo(leafletMap);

function renderStreets() {
  streetsLayer.clearLayers();
  for (const edge of mapModel.getEdges()) {
    const isSelected = edge.id === selectedEdgeId;
    const color = edge.blocked ? '#ff3d00' : isSelected ? '#0077b6' : '#26394f';
    const poly = L.polyline(edgeLatLngs(edge), { color, weight: edge.blocked ? 13 : 10, opacity: edge.blocked ? 0.95 : 0.75, lineCap: 'round' }).addTo(streetsLayer);
    poly.on('click', () => { selectedEdgeId = edge.id; addLog('rua selecionada: ' + edge.name + ' (' + edge.id + ')'); renderAll(); });
    const mid = edgeLatLngs(edge)[Math.floor(edgeLatLngs(edge).length / 2)];
    L.marker(mid, { icon: L.divIcon({ className: '', html: '<div class="map-tag">' + (edge.blocked ? '🚧 ' : '') + edge.id + '</div>' }), interactive: false }).addTo(streetsLayer);
    if (edge.reason === 'fire') {
      L.marker(mid, { icon: L.divIcon({ className: '', html: '<div class="fire-marker">🔥<span>RUA BLOQUEADA</span></div>' }), interactive: false }).addTo(streetsLayer);
    }
  }
}

function renderNodes() {
  nodesLayer.clearLayers();
  for (const node of mapModel.getNodes()) {
    const p = nodeLatLng(node);
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: '<div class="node ' + (node.type === 'exit' ? 'exit' : '') + '"></div><div class="node-label">' + node.id + '</div>' }),
      title: node.name
    }).addTo(nodesLayer);
  }
}

function renderRoutes() {
  routesLayer.clearLayers();
  for (const agent of agents) {
    if (agent.state === AGENT_STATES.EVACUATED || !agent.track || agent.track.length < 2) continue;
    const color = agent.id === selectedAgentId ? '#00e676' : '#38bdf8';
    L.polyline(agent.track.map(p => xyToLatLng(p.x, p.y)), { color, weight: agent.id === selectedAgentId ? 5 : 3, opacity: 0.8, dashArray: '9 7', lineCap: 'round' }).addTo(routesLayer);
    if (agent.destinationPoint) {
      const exit = xyToLatLng(agent.destinationPoint.x, agent.destinationPoint.y);
      L.marker([exit.lat, exit.lng], { icon: L.divIcon({ className: '', html: '<div class="safe-marker">✓</div>' }), interactive: false }).addTo(routesLayer);
    }
  }
}

function renderAgents() {
  agentsLayer.clearLayers();
  for (const agent of agents) {
    if (agent.state === AGENT_STATES.EVACUATED) continue;
    const p = xyToLatLng(agent.x, agent.y);
    const html = '<div class="agent-token ' + agent.type + ' ' + agent.state.toLowerCase() + '">' + (agent.type === 'car' ? '🚗' : '🧍') + '</div>';
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html, iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false }).addTo(agentsLayer);
  }
}

function renderOverlay() {
  overlayContainer.innerHTML = '';
  if (activeTab === 'tab-mapa') return;
  const card = document.createElement('div');
  card.className = 'overlay-card';
  if (activeTab === 'tab-comparar') {
    card.innerHTML = '<strong>A* vs Dijkstra</strong><div class="compare-grid"><div class="compare-box astar-box"><div class="title">A*</div><div class="compare-metric"><span>Nós</span><strong>' + (lastPathResult?.nodesExplored || '—') + '</strong></div><div class="compare-metric"><span>Custo</span><strong>' + Math.round(lastPathResult?.cost || 0) + '</strong></div></div><div class="compare-box dijkstra-box"><div class="title">Dijkstra</div><div class="compare-metric"><span>Nós</span><strong>' + (dijkstraResult?.nodesExplored || '—') + '</strong></div><div class="compare-metric"><span>Custo</span><strong>' + Math.round(dijkstraResult?.cost || 0) + '</strong></div></div></div>';
  } else if (activeTab === 'tab-custo') {
    card.innerHTML = '<strong>Custo da rota</strong><p>A linha verde é gerada diretamente pelo caminho retornado pelo A*: ' + (lastPathResult?.path.join(' → ') || 'sem rota') + '.</p>';
  } else {
    card.innerHTML = '<strong>Nós explorados</strong><p>A* explorou ' + (lastPathResult?.nodesExplored || 0) + ' nós na última rota válida.</p>';
  }
  overlayContainer.appendChild(card);
}

function renderAll() { renderStreets(); renderRoutes(); renderNodes(); renderAgents(); renderOverlay(); updateStats(); }

function updateStats() {
  const evacuated = agents.filter(a => a.state === AGENT_STATES.EVACUATED).length;
  statEvacuados.textContent = evacuated;
  statTotal.textContent = agents.length;
  fieldAgentes.textContent = agents.length;
  statTempo.textContent = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0') + ':' + String(elapsedSeconds % 60).padStart(2, '0');
  statNos.textContent = lastPathResult?.nodesExplored ?? '—';
  statCusto.textContent = lastPathResult ? Math.round(lastPathResult.cost) : '—';
  statFireAstar.textContent = lastPathResult ? (lastPathResult.nodesExplored + ' nós') : '—';
  statFireDijkstra.textContent = dijkstraResult ? (dijkstraResult.nodesExplored + ' nós') : '—';
  const blocked = mapModel.getEdges().filter(e => e.blocked).length;
  const statusPanel = document.getElementById('live-status-summary');
  if (statusPanel) statusPanel.innerHTML = '<div>Agentes: <strong>' + agents.length + '</strong></div><div>Ruas bloqueadas: <strong>' + blocked + '</strong></div><div>Rotas recalculadas: <strong>' + recalculationCount + '</strong></div>';
}

let chartHistory = [];
function updateChart(reset = false) {
  if (reset) chartHistory = [];
  const pct = agents.length ? agents.filter(a => a.state === AGENT_STATES.EVACUATED).length / agents.length * 100 : 0;
  chartHistory.push({ t: elapsedSeconds, pct });
  if (chartHistory.length > 24) chartHistory.shift();
  const step = chartHistory.length > 1 ? 100 / (chartHistory.length - 1) : 0;
  const points = chartHistory.map((p, i) => (i * step).toFixed(1) + ',' + (100 - p.pct).toFixed(1));
  evacLine.setAttribute('points', points.join(' '));
  evacArea.setAttribute('points', points.concat(['100,100', '0,100']).join(' '));
  chartXStart.textContent = chartHistory[0]?.t + 's' || '0s';
  chartXMid.textContent = chartHistory[Math.floor(chartHistory.length / 2)]?.t + 's' || '—';
  chartXEnd.textContent = elapsedSeconds + 's';
}

function moveAgent(agent, dt) {
  if (agent.state !== AGENT_STATES.MOVING) return;
  if (!isPathValid(agent)) {
    agent.state = AGENT_STATES.BLOCKED;
    planAgent(agent, true);
    return;
  }
  agent.trackProgress += agent.speed * speed * dt;
  const total = distanceAlong(agent.track);
  if (agent.trackProgress >= total) {
    agent.x = agent.destinationPoint.x;
    agent.y = agent.destinationPoint.y + agent.offset;
    agent.currentNode = agent.destinationNode;
    agent.state = AGENT_STATES.EVACUATED;
    addLog('✓ evacuação concluída: agente ' + agent.id + ' chegou à saída segura');
    return;
  }
  const p = pointOnTrack(agent.track, agent.trackProgress);
  agent.x = p.x;
  agent.y = p.y + agent.offset;
}

function frame(ts) {
  if (!lastFrame) lastFrame = ts;
  const dt = Math.min(0.08, (ts - lastFrame) / 1000);
  lastFrame = ts;
  if (state === 'running') {
    for (const agent of agents) moveAgent(agent, dt);
    if (agents.length && agents.every(a => a.state === AGENT_STATES.EVACUATED)) {
      setStatus('stopped');
      stopTimer();
      addLog('✓ todos os agentes evacuados');
    }
    renderAgents();
    updateStats();
  }
  requestAnimationFrame(frame);
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => { if (state === 'running') { elapsedSeconds++; updateChart(); updateStats(); } }, 1000);
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

function buildExtraControls() {
  const tools = document.querySelectorAll('.tool-btn');
  tools.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      activeTool = tool;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b === btn));
      mapCanvas.classList.add('tool-active');
      addLog('clique em uma rua para: ' + btn.textContent.trim());
    });
  });
  const panel = tools[0]?.parentElement;
  if (!panel) return;
  const edgeSelect = document.createElement('select');
  edgeSelect.className = 'edge-select';
  edgeSelect.innerHTML = mapModel.getEdges().map(e => '<option value="' + e.id + '">' + e.id + ' · ' + e.name + '</option>').join('');
  edgeSelect.value = selectedEdgeId;
  edgeSelect.addEventListener('change', () => { selectedEdgeId = edgeSelect.value; renderAll(); });
  panel.insertBefore(edgeSelect, tools[0]);

  const fireBtn = document.createElement('button');
  fireBtn.className = 'btn ghost';
  fireBtn.textContent = '🔥 Iniciar incêndio';
  fireBtn.addEventListener('click', () => { activeTool = 'incendio'; mapCanvas.classList.add('tool-active'); addLog('clique na rua onde o incêndio começou'); });
  panel.appendChild(fireBtn);

  const carBtn = document.createElement('button');
  carBtn.className = 'btn ghost';
  carBtn.textContent = '🚗 Adicionar carro';
  carBtn.addEventListener('click', () => { activeTool = 'carro'; mapCanvas.classList.add('tool-active'); addLog('clique em uma rua para colocar o carro'); });
  panel.appendChild(carBtn);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn ghost';
  clearBtn.textContent = '🚧 Remover bloqueio selecionado';
  clearBtn.addEventListener('click', () => {
    const edge = mapModel.setEdgeBlocked(selectedEdgeId, false);
    if (edge) { rebuildGraph(); addLog('bloqueio removido em ' + edge.name); replanAll(edge.name); }
  });
  panel.appendChild(clearBtn);

  const liveStatus = document.createElement('div');
  liveStatus.id = 'live-status-summary';
  liveStatus.className = 'mini-status';
  panel.appendChild(liveStatus);
}

function finishTool() {
  activeTool = null;
  mapCanvas.classList.remove('tool-active');
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
}


function setupThemeAndTutorial() {
  const themeToggle = qs('theme-toggle');
  const savedTheme = localStorage.getItem('urbanisa-theme') || 'light';
  const applyTheme = (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('urbanisa-theme', next);
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
      themeToggle.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">' + (next === 'dark' ? '☀️' : '🌙') + '</span><span class="theme-toggle-text">' + (next === 'dark' ? 'Modo Claro' : 'Modo Escuro') + '</span>';
    }
  };
  applyTheme(savedTheme);
  setTimeout(() => document.documentElement.classList.add('theme-ready'), 0);
  themeToggle?.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  const tutorialModal = qs('tutorial-modal');
  const slides = Array.from(document.querySelectorAll('.tutorial-slide'));
  const dots = Array.from(document.querySelectorAll('.slide-dots .dot'));
  const prev = qs('btn-prev-slide');
  const next = qs('btn-next-slide');
  let index = 0;
  const showSlide = (nextIndex) => {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    if (prev) prev.disabled = index === 0;
    if (next) next.textContent = index === slides.length - 1 ? 'Concluir 🚀' : 'Próximo ▶';
  };
  prev?.addEventListener('click', () => showSlide(index - 1));
  next?.addEventListener('click', () => {
    if (index === slides.length - 1) tutorialModal.style.display = 'none';
    else showSlide(index + 1);
  });
  showSlide(0);
}
function wireUi() {
  qs('btn-start-hero')?.addEventListener('click', () => { qs('urbanisa-modal').style.display = 'none'; leafletMap.invalidateSize(); });
  qs('btn-tutorial-hero')?.addEventListener('click', () => { qs('urbanisa-modal').style.display = 'none'; qs('tutorial-modal').style.display = 'flex'; });
  qs('btn-open-tutorial')?.addEventListener('click', () => { qs('tutorial-modal').style.display = 'flex'; });
  qs('btn-close-tutorial')?.addEventListener('click', () => { qs('tutorial-modal').style.display = 'none'; });
  qs('btn-iniciar')?.addEventListener('click', () => { setStatus('running'); startTimer(); addLog('simulação iniciada'); });
  qs('btn-pausar')?.addEventListener('click', () => { setStatus('paused'); stopTimer(); addLog('simulação pausada'); });
  qs('btn-reiniciar')?.addEventListener('click', resetSimulation);
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active'); qs(btn.dataset.view)?.classList.add('active'); setTimeout(() => leafletMap.invalidateSize(), 50);
  }));
  mapToolbar.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    mapToolbar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active'); activeTab = chip.dataset.tab; renderAll();
  }));
  if (speedTrack) {
    speedTrack.addEventListener('click', e => {
      const rect = speedTrack.getBoundingClientRect();
      speed = 0.5 + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 2.5;
      const pct = ((speed - 0.5) / 2.5) * 100;
      speedFill.style.width = pct + '%'; speedThumb.style.left = pct + '%'; speedLabel.textContent = speed.toFixed(1) + '×';
    });
  }
  leafletMap.on('click', evt => {
    const xy = latLngToXY(evt.latlng.lat, evt.latlng.lng);
    const snap = snapToRoad(xy);
    if (!snap) return;
    selectedEdgeId = snap.edge.id;
    if (!activeTool) {
      addLog('rua selecionada: ' + snap.edge.name);
      renderAll();
      return;
    }
    if (activeTool === 'bloqueio') blockEdge(snap.edge.id, 'block');
    if (activeTool === 'incendio') blockEdge(snap.edge.id, 'fire');
    if (activeTool === 'pessoa' || activeTool === 'carro') addAgent(activeTool === 'carro' ? 'car' : 'person', snap.nearestNode, getExitId(), snap.point);
    if (activeTool === 'saida') {
      const agent = agents.find(a => a.id === selectedAgentId) || agents.find(a => a.state !== AGENT_STATES.EVACUATED);
      if (agent) {
        agent.destinationNode = snap.nearestNode;
        agent.destinationPoint = { ...snap.point };
        planAgent(agent, true);
        addLog('saída segura definida para agente ' + agent.id + ' em ' + snap.edge.name);
      } else {
        addLog('<span class="warn">adicione um agente antes de definir a saída</span>');
      }
    }
    finishTool();
    renderAll();
  });
}

setupThemeAndTutorial();
buildExtraControls();
wireUi();
resetSimulation();
requestAnimationFrame(frame);



