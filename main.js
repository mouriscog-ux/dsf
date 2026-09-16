// ============================================================
// URBANISA TECH — SmartEvac Liberdade
// Engine de Simulação e Busca de Rotas A*
// Feira de Ciências 2026 · São Paulo
// ============================================================

(function () {
  'use strict';

  /* ---------- 1. MODAL URBANISA TECH & TUTORIAL DA FEIRA ---------- */
  var urbanisaModal   = document.getElementById('urbanisa-modal');
  var tutorialModal   = document.getElementById('tutorial-modal');
  var btnStartHero    = document.getElementById('btn-start-hero');
  var btnTutorialHero = document.getElementById('btn-tutorial-hero');
  var btnOpenTutorial = document.getElementById('btn-open-tutorial');
  var btnCloseTutorial= document.getElementById('btn-close-tutorial');
  var btnPrevSlide    = document.getElementById('btn-prev-slide');
  var btnNextSlide    = document.getElementById('btn-next-slide');

  var currentSlideIndex = 1;
  var totalSlides = 4;

  function updateTutorialSlide(index) {
    currentSlideIndex = Math.min(totalSlides, Math.max(1, index));
    var slides = tutorialModal.querySelectorAll('.tutorial-slide');
    var dots   = tutorialModal.querySelectorAll('.slide-dots .dot');

    slides.forEach(function (s) { s.classList.remove('active'); });
    dots.forEach(function (d) { d.classList.remove('active'); });

    var targetSlide = tutorialModal.querySelector('.tutorial-slide[data-slide="' + currentSlideIndex + '"]');
    if (targetSlide) targetSlide.classList.add('active');
    if (dots[currentSlideIndex - 1]) dots[currentSlideIndex - 1].classList.add('active');

    btnPrevSlide.disabled = currentSlideIndex === 1;
    btnNextSlide.textContent = currentSlideIndex === totalSlides ? 'Concluir 🚀' : 'Próximo ▶';
  }

  btnStartHero.addEventListener('click', function () {
    urbanisaModal.style.display = 'none';
    addLog('URBANISA TECH — Simulação iniciada pela tela de apresentação');
    setTimeout(function () { leafletMap.invalidateSize(); }, 50);
  });

  btnTutorialHero.addEventListener('click', function () {
    urbanisaModal.style.display = 'none';
    tutorialModal.style.display = 'flex';
    updateTutorialSlide(1);
  });

  btnOpenTutorial.addEventListener('click', function () {
    tutorialModal.style.display = 'flex';
    updateTutorialSlide(1);
  });

  btnCloseTutorial.addEventListener('click', function () {
    tutorialModal.style.display = 'none';
  });

  btnPrevSlide.addEventListener('click', function () {
    updateTutorialSlide(currentSlideIndex - 1);
  });

  btnNextSlide.addEventListener('click', function () {
    if (currentSlideIndex === totalSlides) {
      tutorialModal.style.display = 'none';
      addLog('Tutorial da Feira concluído');
    } else {
      updateTutorialSlide(currentSlideIndex + 1);
    }
  });

  /* ---------- 2. NAVEGAÇÃO ENTRE ABAS PRINCIPAIS ---------- */
  var navButtons = document.querySelectorAll('.nav-btn:not(.tutorial-trigger)');
  var views = document.querySelectorAll('.view');

  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navButtons.forEach(function (b) { b.classList.remove('active'); });
      views.forEach(function (v) { v.classList.remove('active'); });
      btn.classList.add('active');
      var viewEl = document.getElementById(btn.dataset.view);
      if (viewEl) viewEl.classList.add('active');

      if (btn.dataset.view === 'view-simulacao') {
        setTimeout(function () { leafletMap.invalidateSize(); }, 0);
      }
    });
  });

  /* ---------- 3. ELEMENTOS DO SIMULADOR ---------- */
  var btnIniciar   = document.getElementById('btn-iniciar');
  var btnPausar    = document.getElementById('btn-pausar');
  var btnReiniciar = document.getElementById('btn-reiniciar');

  var statusDot  = document.getElementById('status-dot');
  var statusText = document.getElementById('status-text');

  var statEvacuados = document.getElementById('stat-evacuados');
  var statTotal     = document.getElementById('stat-total');
  var statTempo     = document.getElementById('stat-tempo');
  var statNos       = document.getElementById('stat-nos');
  var statPresos    = document.getElementById('stat-presos');
  var fieldAgentes  = document.getElementById('field-agentes');

  var logList          = document.getElementById('log-list');
  var mapCanvas        = document.getElementById('map-canvas');

  var evacLine    = document.getElementById('evac-line');
  var evacArea    = document.getElementById('evac-area');
  var chartXStart = document.getElementById('chart-x-start');
  var chartXMid   = document.getElementById('chart-x-mid');
  var chartXEnd   = document.getElementById('chart-x-end');

  var toolButtons = document.querySelectorAll('.tool-btn');
  var fireIntensityInput = document.getElementById('fire-intensity');
  var fireSpreadInput = document.getElementById('fire-spread');
  var fireIntensityLabel = document.getElementById('fire-intensity-label');
  var fireSpreadLabel = document.getElementById('fire-spread-label');

  var DEFAULT_LOG = [
    'URBANISA TECH iniciada — 50 agentes',
    '<span class="warn">Bloqueio registrado na malha viária</span>',
    'Agentes calculando rota via A*',
    '<span class="hl">Agente evacuou por uma saída segura</span>'
  ];
  var MAX_LOG_LINES = 6;

  function addLog(html) {
    var line = document.createElement('div');
    line.innerHTML = '&gt; ' + html;
    logList.insertBefore(line, logList.firstChild);
    while (logList.children.length > MAX_LOG_LINES) {
      logList.removeChild(logList.lastChild);
    }
  }

  function resetLog() {
    logList.innerHTML = '';
    DEFAULT_LOG.forEach(function (html) {
      var line = document.createElement('div');
      line.innerHTML = '&gt; ' + html;
      logList.appendChild(line);
    });
  }

  /* ---------- 3.5 MAPA REAL — LEAFLET + OPENSTREETMAP ---------- */
  // O grafo do simulador vive num espaço "modelo" abstrato (x,y em metros aproximados).
  // Aqui definimos a correspondência entre esse espaço abstrato e a área geográfica
  // real do Bairro da Liberdade (SP), para desenhar tudo em cima do mapa de verdade.
  // Limite manual do cenário, definido pelas referências solicitadas:
  // norte: Viaduto Doutor Manoel José Chaves; sul: Estação São Joaquim;
  // leste: EMEF Duque de Caxias; oeste: região do encontro da Rua Major Diogo
  // com a Av. Brigadeiro Luís Antônio. Mantemos uma pequena margem para que
  // os pontos de referência não sejam cortados pela borda.
  var MODEL_BOUNDS = { minX: 40, maxX: 440, minY: 40, maxY: 340 };
  var GEO_BOUNDS = { south: -23.56205, north: -23.55245, west: -46.64410, east: -46.62845 };

  function getNodeByXY(x, y) {
    if (!nodes) return null;
    for (var i = 0; i < nodes.length; i++) {
      if (Math.abs(nodes[i].x - x) < 0.1 && Math.abs(nodes[i].y - y) < 0.1) return nodes[i];
    }
    return null;
  }

  function xyToLatLng(x, y) {
    var found = getNodeByXY(x, y);
  
    if (found && found.lat !== undefined && found.lng !== undefined) {
      return {
        lat: found.lat,
        lng: found.lng
      };
    }
  
    var lng = GEO_BOUNDS.west +
      (x - MODEL_BOUNDS.minX) /
      (MODEL_BOUNDS.maxX - MODEL_BOUNDS.minX) *
      (GEO_BOUNDS.east - GEO_BOUNDS.west);
  
    var lat = GEO_BOUNDS.north -
      (y - MODEL_BOUNDS.minY) /
      (MODEL_BOUNDS.maxY - MODEL_BOUNDS.minY) *
      (GEO_BOUNDS.north - GEO_BOUNDS.south);
  
    return {
      lat: lat,
      lng: lng
    };
  }

  function latLngToXY(lat, lng) {
    var x = MODEL_BOUNDS.minX + (lng - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west) * (MODEL_BOUNDS.maxX - MODEL_BOUNDS.minX);
    var y = MODEL_BOUNDS.minY + (GEO_BOUNDS.north - lat) / (GEO_BOUNDS.north - GEO_BOUNDS.south) * (MODEL_BOUNDS.maxY - MODEL_BOUNDS.minY);
    return { x: x, y: y };
  }

  // "Efeito parede": o usuário navega apenas dentro da área coberta pelos nós.
  var WALL_BOUNDS = L.latLngBounds(
    L.latLng(GEO_BOUNDS.south, GEO_BOUNDS.west),
    L.latLng(GEO_BOUNDS.north, GEO_BOUNDS.east)
  );

  var leafletMap = L.map('leaflet-map', {
    center: [(GEO_BOUNDS.north + GEO_BOUNDS.south) / 2, (GEO_BOUNDS.west + GEO_BOUNDS.east) / 2],
    zoom: 16,
    // O novo recorte tem cerca de 1 km; o zoom mínimo 16 permite que o
    // fitBounds exiba a área inteira sem liberar a navegação para fora dela.
    zoomSnap: 0.1,
    minZoom: 16,
    maxZoom: 19,
    maxBounds: WALL_BOUNDS,
    maxBoundsViscosity: 1.0
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);

  function fitMapToScenarioBounds() {
    // O tamanho do mapa é manual e não muda conforme a quantidade de nós.
    leafletMap.invalidateSize();
    leafletMap.fitBounds(WALL_BOUNDS, {
      padding: [14, 14],
      maxZoom: 19,
      animate: false
    });
  }

  // Camadas redesenhadas a cada frame da simulação
  var streetsLayer  = L.layerGroup().addTo(leafletMap); // arestas do grafo (ruas)
  var nodesLayer     = L.layerGroup().addTo(leafletMap); // cruzamentos / bloqueios
  // Saídas usam uma camada própria para não sumirem junto com os nós.
  var exitsLayer     = L.layerGroup().addTo(leafletMap);
  // Bloqueios também precisam continuar visíveis quando os nós são ocultados.
  var hazardsLayer   = L.layerGroup().addTo(leafletMap);
  var routesLayer    = L.layerGroup().addTo(leafletMap); // rotas calculadas pelo A*
  var agentsLayer    = L.layerGroup().addTo(leafletMap); // pessoas em evacuação
  var costTagsLayer  = L.layerGroup().addTo(leafletMap); // rótulos f(n)/g(n)/h(n)

  /* ---------- 4. GRAFO VIA API ---------- */
  // A simulação não possui malha embarcada: estes dados só são preenchidos
  // quando a API OSM retorna uma resposta válida.
  var apiInitialNodes = [];
  var apiInitialEdges = [];

  var nodes = [];
  var edges = [];
  var activeFires = [];

  function getNode(id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  function getNeighbors(nodeId) {
    var list = [];
    edges.forEach(function (e) {
      if (e.blocked) return;
      if (e.from === nodeId) {
        var target = getNode(e.to);
        if (target && target.type !== 'blocked') list.push({ node: target, weight: e.weight });
      // As arestas vindas do OSM já carregam os dois sentidos quando a rua
      // permite tráfego nos dois sentidos. Não crie aqui o sentido inverso de
      // uma via de mão única.
      } else if (e.to === nodeId && !e.directed) {
        var target = getNode(e.from);
        if (target && target.type !== 'blocked') list.push({ node: target, weight: e.weight });
      }
    });
    return list;
  }

  function getEdgeNameBetween(a, b) {
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if ((e.from === a && e.to === b) || (e.from === b && e.to === a)) return e.name;
    }
    return 'rota de evacuação';
  }

  function safeNodeName(node, fallback) {
    return node && node.name ? node.name : (fallback || 'ponto de evacuação');
  }

  function safeLatLngFromXY(x, y) {
    var p = xyToLatLng(Number(x) || MODEL_BOUNDS.minX, Number(y) || MODEL_BOUNDS.minY);
    return {
      lat: Number.isFinite(p.lat) ? p.lat : (GEO_BOUNDS.north + GEO_BOUNDS.south) / 2,
      lng: Number.isFinite(p.lng) ? p.lng : (GEO_BOUNDS.west + GEO_BOUNDS.east) / 2
    };
  }

  function safeNodeLatLng(node) {
    if (node && Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
      return { lat: node.lat, lng: node.lng };
    }
    return safeLatLngFromXY(node ? node.x : MODEL_BOUNDS.minX, node ? node.y : MODEL_BOUNDS.minY);
  }

  function getFireDangerAtNode(node) {
    var danger = 0;
    activeFires.forEach(function (fire) {
      var d = Math.hypot(node.x - fire.x, node.y - fire.y);
      if (d <= fire.radius) danger += (1 - d / fire.radius) * fire.intensity;
    });
    return danger;
  }

  function getFireEdgePenalty(fromNode, toNode) {
    if (!fromNode || !toNode || activeFires.length === 0) return 0;
    var mid = { x: (fromNode.x + toNode.x) / 2, y: (fromNode.y + toNode.y) / 2 };
    var danger = getFireDangerAtNode(fromNode) + getFireDangerAtNode(toNode) + getFireDangerAtNode(mid);
    return danger * 45;
  }

  function getDynamicWeight(currentId, neighborId, baseWeight) {
    return baseWeight + getFireEdgePenalty(getNode(currentId), getNode(neighborId));
  }

  function distance(nodeA, nodeB) {
    if (nodeA.lat !== undefined && nodeB.lat !== undefined) {
      var dLat = (nodeA.lat - nodeB.lat) * 111320;
      var dLng = (nodeA.lng - nodeB.lng) * 111320 * Math.cos(nodeA.lat * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    }
    var dx = nodeA.x - nodeB.x;
    var dy = nodeA.y - nodeB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------- 5. MOTOR DE BUSCA A* ---------- */
  function findPath(startId, useHeuristic) {
    var startNode = getNode(startId);
    if (!startNode || startNode.type === 'blocked') return null;

    var exitNodes = nodes.filter(function (n) { return n.type === 'exit'; });
    if (exitNodes.length === 0) return null;

    function heuristic(n) {
      if (!useHeuristic) return 0;
      var minH = Infinity;
      exitNodes.forEach(function (exit) {
        var h = distance(n, exit);
        if (h < minH) minH = h;
      });
      return minH;
    }

    var gScore = {};
    var fScore = {};
    var cameFrom = {};
    var openSet = [startId];
    var closedSet = [];
    var explorationOrder = [];

    nodes.forEach(function (n) {
      gScore[n.id] = Infinity;
      fScore[n.id] = Infinity;
    });

    gScore[startId] = 0;
    fScore[startId] = heuristic(startNode);

    while (openSet.length > 0) {
      var currentId = openSet[0];
      var lowestF = fScore[currentId];
      var currentIndex = 0;

      for (var i = 1; i < openSet.length; i++) {
        var id = openSet[i];
        if (fScore[id] < lowestF) {
          lowestF = fScore[id];
          currentId = id;
          currentIndex = i;
        }
      }

      openSet.splice(currentIndex, 1);
      closedSet.push(currentId);
      explorationOrder.push(currentId);

      var currNode = getNode(currentId);
      if (currNode && currNode.type === 'exit') {
        var path = [currentId];
        var temp = currentId;
        while (cameFrom[temp]) {
          temp = cameFrom[temp];
          path.unshift(temp);
        }
        return {
          path: path,
          cost: gScore[currentId],
          nodesExplored: closedSet.length,
          explorationOrder: explorationOrder,
          closedSet: closedSet,
          openSet: openSet,
          destinationExit: currNode,
          gScore: gScore,
          fScore: fScore
        };
      }

      var neighbors = getNeighbors(currentId);
      neighbors.forEach(function (nb) {
        var neighborId = nb.node.id;
        if (closedSet.indexOf(neighborId) !== -1) return;

        var tentativeG = gScore[currentId] + getDynamicWeight(currentId, neighborId, nb.weight);
        if (tentativeG < gScore[neighborId]) {
          cameFrom[neighborId] = currentId;
          gScore[neighborId] = tentativeG;
          fScore[neighborId] = tentativeG + heuristic(nb.node);
          if (openSet.indexOf(neighborId) === -1) {
            openSet.push(neighborId);
          }
        }
      });
    }

    return null;
  }

  /* ---------- 6. ESTADO E AGENTES ---------- */
  var STATE = { STOPPED: 'stopped', RUNNING: 'running', PAUSED: 'paused' };
  var state = STATE.STOPPED;

  var totalAgentes = 50;
  var MAX_AGENTES = 200;
  var evacuados = 0;
  var elapsedSeconds = 0;
  var speed = 1.5;
  var tickTimer = null;
  var agents = [];

  function snapToNearestStreet(lat, lng) {
    var minDistance = Infinity;
    var clickedXY = latLngToXY(lat, lng);
    // Mantém o marcador no ponto clicado até encontrar uma rua elegível.
    // O valor antigo (0, 0) podia posicionar alguns bloqueios fora do mapa.
    var bestPoint = {
      lat: lat,
      lng: lng,
      x: clickedXY.x,
      y: clickedXY.y,
      fromNodeId: null,
      toNodeId: null,
      progress: 0
    };

    edges.forEach(function (e) {
      var n1 = getNode(e.from);
      var n2 = getNode(e.to);
      if (!n1 || !n2 || n1.type === 'blocked' || n2.type === 'blocked') return;

      var n1Lat = n1.lat !== undefined ? n1.lat : xyToLatLng(n1.x, n1.y).lat;
      var n1Lng = n1.lng !== undefined ? n1.lng : xyToLatLng(n1.x, n1.y).lng;
      var n2Lat = n2.lat !== undefined ? n2.lat : xyToLatLng(n2.x, n2.y).lat;
      var n2Lng = n2.lng !== undefined ? n2.lng : xyToLatLng(n2.x, n2.y).lng;

      var dLat = n2Lat - n1Lat;
      var dLng = n2Lng - n1Lng;
      var lenSq = dLat * dLat + dLng * dLng;
      if (lenSq === 0) return;

      var t = Math.max(0, Math.min(1, ((lat - n1Lat) * dLat + (lng - n1Lng) * dLng) / lenSq));
      var projLat = n1Lat + t * dLat;
      var projLng = n1Lng + t * dLng;
      var dist = Math.hypot(lat - projLat, lng - projLng);

      if (dist < minDistance) {
        minDistance = dist;
        bestPoint = {
          lat: projLat,
          lng: projLng,
          x: n1.x + t * (n2.x - n1.x),
          y: n1.y + t * (n2.y - n1.y),
          fromNodeId: e.from,
          toNodeId: e.to,
          progress: t
        };
      }
    });

    return bestPoint;
  }

  function randomizeExits() {
    nodes.forEach(function (n) {
      if (n.type !== 'blocked') n.type = 'normal';
    });

    // Uma saída precisa poder ser alcançada por alguma aresta. Sem essa
    // restrição, uma rua isolada pode virar saída e deixar agentes sem rota.
    var validCandidates = nodes.filter(function (n) {
      return n.type === 'normal' && hasIncomingConnection(n.id);
    });
    if (validCandidates.length === 0) return;

    for (var i = validCandidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = validCandidates[i];
      validCandidates[i] = validCandidates[j];
      validCandidates[j] = temp;
    }

    var numExits = Math.min(3, validCandidates.length);
    for (var k = 0; k < numExits; k++) {
      validCandidates[k].type = 'exit';
    }

    addLog('<span class="hl">Saídas de emergência sorteadas aleatoriamente nas ruas</span>');
  }

  function hasIncomingConnection(nodeId) {
    return edges.some(function (edge) {
      if (edge.blocked) return false;
      var from = getNode(edge.from);
      var to = getNode(edge.to);
      if (!from || !to || from.type === 'blocked' || to.type === 'blocked') return false;
      return edge.to === nodeId || (!edge.directed && edge.from === nodeId);
    });
  }

  function getNodeIdsThatCanReachAnExit() {
    // Percorre as arestas no sentido inverso, partindo das saídas. Assim, um
    // nó só é elegível para receber um agente se houver uma rota válida dele
    // até uma saída, respeitando ruas de mão única e bloqueios.
    var reverseEdges = new Map();
    nodes.forEach(function (node) { reverseEdges.set(node.id, []); });

    edges.forEach(function (edge) {
      if (edge.blocked) return;
      var from = getNode(edge.from);
      var to = getNode(edge.to);
      if (!from || !to || from.type === 'blocked' || to.type === 'blocked') return;
      reverseEdges.get(to.id).push(from.id);
      if (!edge.directed) reverseEdges.get(from.id).push(to.id);
    });

    var reachable = new Set();
    var pending = nodes.filter(function (node) { return node.type === 'exit'; }).map(function (node) { return node.id; });
    while (pending.length > 0) {
      var nodeId = pending.pop();
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      (reverseEdges.get(nodeId) || []).forEach(function (previousId) {
        if (!reachable.has(previousId)) pending.push(previousId);
      });
    }
    return reachable;
  }

  function createAgent(id, startNodeId, reachableNodeIds) {
    // Um agente só começa em um nó da malha viária. Antes ele nascia no meio
    // de uma aresta, mas sua rota começava em outro nó; no primeiro frame isso
    // criava um segmento em linha reta que podia atravessar prédios.
    reachableNodeIds = reachableNodeIds || getNodeIdsThatCanReachAnExit();
    var normalNodes = nodes.filter(function (n) {
      return n.type === 'normal' && reachableNodeIds.has(n.id) && getNeighbors(n.id).length > 0;
    });
    var requestedNode = getNode(startNodeId);
    var randNode = requestedNode && requestedNode.type === 'normal' && reachableNodeIds.has(requestedNode.id)
      ? requestedNode
      : normalNodes[Math.floor(Math.random() * normalNodes.length)] || nodes.find(function (n) { return n.type === 'exit'; }) || nodes[0];
    var startId = randNode ? randNode.id : 'N1';
    var res = findPath(startId, true);
    var pos = safeNodeLatLng(randNode);

    return {
      id: id,
      currentNodeId: startId,
      path: res ? res.path : [startId],
      pathIndex: 0,
      segmentProgress: 0,
      lat: pos.lat,
      lng: pos.lng,
      x: randNode ? randNode.x : 0,
      y: randNode ? randNode.y : 0,
      evacuated: false,
      trapped: !res
    };
  }

  function initAgents() {
    agents = [];
    // Todas as pessoas criadas nesta rodada usam a mesma malha e as mesmas
    // saídas; calcular a alcançabilidade uma única vez evita trabalho repetido.
    var reachableNodeIds = getNodeIdsThatCanReachAnExit();
    for (var i = 1; i <= totalAgentes; i++) {
      agents.push(createAgent(i, null, reachableNodeIds));
    }
  }

  function getDynamicGraphPayload() {
    var blockedIds = nodes.filter(function (n) { return n.type === 'blocked'; }).map(function (n) { return n.id; });

    // O backend não mantém uma cópia do grafo. Portanto, depois de a API OSM
    // substituir INITIAL_* pela malha real, enviar apenas o delta resulta em
    // um grafo vazio no /api/pathfind-batch. Envie sempre o grafo atual inteiro.
    return {
      dynamicNodes: nodes,
      dynamicEdges: edges,
      blockedIds: blockedIds
    };
  }

  function recalculateAllAgentPaths() {
    var totalExploredSum = 0;
    var totalCostSum = 0;
    var validCount = 0;

    agents.forEach(function (ag) {
      if (ag.evacuated) return;
      var res = findPath(ag.currentNodeId, true);
      if (res && res.path.length > 0) {
        ag.path = res.path;
        ag.pathIndex = 0;
        ag.segmentProgress = 0;
        ag.trapped = false;
        totalExploredSum += res.nodesExplored;
        totalCostSum += res.cost;
        validCount++;
      } else {
        // Nunca mantenha uma rota anterior se ela passou a incluir um bloqueio.
        ag.path = [ag.currentNodeId];
        ag.pathIndex = 0;
        ag.segmentProgress = 0;
        ag.trapped = true;
      }
    });

    if (validCount > 0) {
      statNos.textContent = Math.round(totalExploredSum / validCount);
    }

  }

  function forceRecalculateForFire() {
    addLog('<span class="warn">AGENTES RECALCULANDO ROTA VIA A*</span>');
    recalculateAllAgentPaths();
  }

  function blockStreetAtSnap(snap) {
    if (!snap || !snap.fromNodeId || !snap.toNodeId) return 0;
    var blockedSegments = 0;
    edges.forEach(function (edge) {
      var isSameStreetSegment =
        (edge.from === snap.fromNodeId && edge.to === snap.toNodeId) ||
        (edge.from === snap.toNodeId && edge.to === snap.fromNodeId);
      if (isSameStreetSegment) {
        edge.blocked = true;
        blockedSegments++;
      }
    });
    return blockedSegments;
  }

  function getApiUrl(endpoint) {
    // A API é entregue pelo mesmo servidor que hospeda a interface. Usar uma
    // URL relativa mantém a comunicação funcionando em qualquer porta e em
    // uma publicação remota. Para abrir o HTML diretamente, ou usar outro
    // backend no desenvolvimento, defina window.SMART_EVAC_API_BASE_URL.
    var configuredBaseUrl = window.SMART_EVAC_API_BASE_URL;
    if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, '') + endpoint;
    if (window.location.protocol === 'file:') return 'http://localhost:8080' + endpoint;
    return endpoint;
  }

  function isUsingLocalServer() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  function isWithinScenarioBounds(node) {
    return node && Number.isFinite(node.lat) && Number.isFinite(node.lng) &&
      node.lat >= GEO_BOUNDS.south && node.lat <= GEO_BOUNDS.north &&
      node.lng >= GEO_BOUNDS.west && node.lng <= GEO_BOUNDS.east;
  }

  function normalizeApiGraph(graph) {
    // O servidor pode estar numa versão antiga ou o Overpass pode devolver a
    // geometria inteira de uma via que toca a borda. Reaplique o limite no
    // cliente para que nenhum desses casos faça nós externos chegarem à tela.
    var allowedNodes = (graph.nodes || []).filter(isWithinScenarioBounds);
    var allowedIds = new Set(allowedNodes.map(function (n) { return n.id; }));
    return {
      nodes: allowedNodes.map(function (n) {
        var copy = Object.assign({}, n);
        var xy = latLngToXY(copy.lat, copy.lng);
        copy.x = xy.x;
        copy.y = xy.y;
        copy.name = copy.name || 'Trecho de via';
        return copy;
      }),
      edges: (graph.edges || []).filter(function (edge) {
        return allowedIds.has(edge.from) && allowedIds.has(edge.to);
      })
    };
  }

  // GitHub Pages só hospeda os arquivos estáticos; portanto /api/graph não
  // existe na versão publicada. Esta rota de contingência consulta o OSM no
  // navegador e tenta mais de um espelho do Overpass, pois a API pode responder 504.
  async function fetchGraphFromOverpass() {
    // Ruas adequadas para circulação; ignora calçadas, trilhas e microvias
    // que aumentam o grafo sem melhorar as rotas de evacuação.
    var query = '[out:json];way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian)$"](' +
      GEO_BOUNDS.south + ',' + GEO_BOUNDS.west + ',' + GEO_BOUNDS.north + ',' + GEO_BOUNDS.east +
      ');out body;>;out skel qt;';
    var endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];
    var data = null;
    var errors = [];

    for (var endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 10000);
      try {
        var response = await fetch(endpoints[endpointIndex], {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: query,
          signal: controller.signal
        });
        if (!response.ok) throw new Error('respondeu ' + response.status);
        data = await response.json();
        break;
      } catch (error) {
        errors.push(endpoints[endpointIndex] + ': ' + error.message);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!data) throw new Error('Serviços Overpass indisponíveis (' + errors.join('; ') + ')');
    var osmNodes = new Map();
    (data.elements || []).forEach(function (el) {
      if (el.type === 'node') osmNodes.set(el.id, { id: el.id, lat: el.lat, lng: el.lon });
    });

    var graphNodes = new Map();
    var graphEdges = [];
    var edgeKeys = new Set();

    function nodeFor(osmId, roadName) {
      var osm = osmNodes.get(osmId);
      // O Overpass devolve a geometria completa de vias que cruzam o retângulo.
      // Não deixe esses trechos incluírem nós além da área do cenário.
      if (!osm || osm.lat < GEO_BOUNDS.south || osm.lat > GEO_BOUNDS.north ||
          osm.lng < GEO_BOUNDS.west || osm.lng > GEO_BOUNDS.east) return null;
      var id = 'node_' + osmId;
      if (!graphNodes.has(id)) {
        graphNodes.set(id, { id: id, osmId: osmId, lat: osm.lat, lng: osm.lng, name: roadName || 'Trecho de via', type: 'normal' });
      }
      return graphNodes.get(id);
    }

    function addEdge(from, to, roadName, wayId) {
      if (!from || !to || from.id === to.id) return;
      var key = from.id + '->' + to.id;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      graphEdges.push({
        from: from.id,
        to: to.id,
        weight: distance(from, to),
        directed: true,
        roadId: 'road_' + wayId,
        roadName: roadName,
        name: roadName
      });
    }

    (data.elements || []).forEach(function (way) {
      if (way.type !== 'way' || !way.tags || !way.tags.highway || !way.nodes || way.nodes.length < 2) return;
      var roadName = way.tags.name || 'Via sem nome';
      var oneWay = way.tags.oneway === 'yes' || way.tags.oneway === '1' || way.tags.oneway === '-1';
      var reverse = way.tags.oneway === '-1';
      for (var i = 0; i < way.nodes.length - 1; i++) {
        var a = nodeFor(way.nodes[i], roadName);
        var b = nodeFor(way.nodes[i + 1], roadName);
        if (!oneWay) {
          addEdge(a, b, roadName, way.id);
          addEdge(b, a, roadName, way.id);
        } else if (reverse) {
          addEdge(b, a, roadName, way.id);
        } else {
          addEdge(a, b, roadName, way.id);
        }
      }
    });

    return { nodes: Array.from(graphNodes.values()), edges: graphEdges };
  }

  async function recalculateAllAgentPathsAsync() {
    var activeAgents = agents.filter(function (ag) { return !ag.evacuated; });
    if (activeAgents.length === 0) return;

    var payloadAgents = activeAgents.map(function (ag) {
      return { id: ag.id, startId: ag.currentNodeId };
    });

    var dynState = getDynamicGraphPayload();

    try {
      var response = await fetch(getApiUrl('/api/pathfind-batch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agents: payloadAgents,
          dynamicNodes: dynState.dynamicNodes,
          dynamicEdges: dynState.dynamicEdges,
          blockedIds: dynState.blockedIds,
          useHeuristic: true
        })
      });

      if (response.ok) {
        var data = await response.json();
        if (data && data.success && data.results) {
          var totalExploredSum = 0;
          var totalCostSum = 0;
          var validCount = 0;

          activeAgents.forEach(function (ag) {
            var res = data.results[ag.id];
            if (res && res.success && res.path && res.path.length > 0) {
              ag.path = res.path;
              ag.pathIndex = 0;
              ag.segmentProgress = 0;
              ag.trapped = false;
              totalExploredSum += res.nodesExplored;
              totalCostSum += res.cost;
              validCount++;
            } else {
              // Sem caminho seguro, o agente para; não continua pela rota antiga.
              ag.path = [ag.currentNodeId];
              ag.pathIndex = 0;
              ag.segmentProgress = 0;
              ag.trapped = true;
            }
          });

          if (validCount > 0) {
            statNos.textContent = Math.round(totalExploredSum / validCount);
          }

          return;
        }
      }
    } catch (err) {
      console.warn('Backend pathfind-batch indisponível, utilizando fallback local', err);
    }

    recalculateAllAgentPaths();
  }

  /* ---------- 7. DESENHO DO MAPA REAL (LEAFLET) E OVERLAYS ---------- */
  function renderGraph() {
    streetsLayer.clearLayers();
    nodesLayer.clearLayers();
    exitsLayer.clearLayers();
    hazardsLayer.clearLayers();
    routesLayer.clearLayers();
    // Mantém a camada e o registro dos marcadores sincronizados antes de redesenhar.
    // Limpar somente a camada faria o Map ainda apontar para ícones já removidos.
    clearAgentMarkers();

    // Desenhos traçados de ruas e rotas sobre o mapa foram removidos
    // para exibir o mapa limpo com marcadores e agentes.

    // Nós comuns ficam invisíveis; as saídas e os bloqueios usam camadas
    // próprias abaixo, para permanecerem visíveis acima de outros elementos.

    // Mantém as saídas sempre acima dos nós e sem os estilos de open/closed set.
    nodes.filter(function (n) { return n.type === 'exit'; }).forEach(function (exit) {
      var exitPoint = safeNodeLatLng(exit);
      var exitIcon = L.divIcon({
        className: '',
        html: '<div class="node exit" title="' + exit.name.replace(/"/g, '&quot;') + '"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([exitPoint.lat, exitPoint.lng], {
        icon: exitIcon,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(exitsLayer);
    });

    // Exibe bloqueios como riscos independentes da camada de nós oculta.
    nodes.filter(function (n) { return n.type === 'blocked'; }).forEach(function (blocked) {
      var blockedPoint = safeNodeLatLng(blocked);
      var blockedIcon = L.divIcon({
        className: '',
        html: '<div class="node blocked fire-active" title="' + blocked.name.replace(/"/g, '&quot;') + '"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([blockedPoint.lat, blockedPoint.lng], {
        icon: blockedIcon,
        interactive: false,
        zIndexOffset: 900
      }).addTo(hazardsLayer);
    });

    // Desenha os agentes (pessoas evacuando) em tempo real nas ruas do Leaflet
    updateAgentMarkers();

    renderFireZones();
  }

  function renderFireZones() {
    costTagsLayer.clearLayers();
    activeFires.forEach(function (fire) {
      var p = xyToLatLng(fire.x, fire.y);
      var icon = L.divIcon({
        className: '',
        html: '<div class="fire-zone" style="width:' + (fire.radius * 2) + 'px;height:' + (fire.radius * 2) + 'px;"></div>',
        iconSize: [fire.radius * 2, fire.radius * 2],
        iconAnchor: [fire.radius, fire.radius]
      });
      L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(costTagsLayer);
    });
  }

  function spreadFire() {
    if (activeFires.length === 0) return;
    // 0,0× é uma opção explícita para manter o incêndio estacionário.
    if (fireSpreadInput && parseFloat(fireSpreadInput.value) <= 0) return;
    var candidates = [];
    activeFires.forEach(function (fire) {
      nodes.forEach(function (n) {
        if (n.type === 'exit' || n.type === 'blocked') return;
        var d = Math.hypot(n.x - fire.x, n.y - fire.y);
        if (d > 0 && d <= fire.radius + (fire.spread * 28)) {
          candidates.push({ node: n, fire: fire, distance: d });
        }
      });
    });
    if (candidates.length === 0) return;
    candidates.sort(function (a, b) { return a.distance - b.distance; });
    var picked = candidates[0];
    igniteFireAtNode(picked.node, 'spread');
    // O espalhamento acontece pelo temporizador, sem clique no mapa. Atualize
    // as camadas logo após acender o novo ponto para que o bloqueio e a zona
    // de risco apareçam imediatamente na tela.
    renderGraph();
    updateStatsDisplay();
  }

  /* ---------- 8. SIMULAÇÃO E MOVIMENTAÇÃO DE AGENTES ---------- */
  function formatTime(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function updateStatsDisplay() {
    statEvacuados.textContent = evacuados;
    statTotal.textContent = totalAgentes;
    statTempo.textContent = formatTime(elapsedSeconds);
    statPresos.textContent = agents.filter(function (ag) { return !ag.evacuated && ag.trapped; }).length;
  }

  var evacHistory = [];
  var MAX_CHART_POINTS = 24;

  function renderChart() {
    if (evacHistory.length === 0) {
      evacLine.setAttribute('points', '');
      evacArea.setAttribute('points', '');
      return;
    }
    var n = evacHistory.length;
    var stepX = n > 1 ? 100 / (n - 1) : 0;

    var linePoints = evacHistory.map(function (point, i) {
      var x = n > 1 ? i * stepX : 0;
      var y = 100 - point.pct;
      return x.toFixed(2) + ',' + y.toFixed(2);
    });

    evacLine.setAttribute('points', linePoints.join(' '));

    var lastX = n > 1 ? (n - 1) * stepX : 100;
    var areaPoints = linePoints.concat([
      lastX.toFixed(2) + ',100',
      '0,100'
    ]);
    evacArea.setAttribute('points', areaPoints.join(' '));
  }

  function updateXAxisLabels() {
    if (evacHistory.length === 0) {
      chartXStart.textContent = '0s';
      chartXMid.textContent = '—';
      chartXEnd.textContent = 'agora';
      return;
    }
    var first = evacHistory[0].t;
    var last = evacHistory[evacHistory.length - 1].t;
    var midIndex = Math.floor((evacHistory.length - 1) / 2);
    var mid = evacHistory[midIndex].t;

    chartXStart.textContent = first + 's';
    chartXMid.textContent = mid + 's';
    chartXEnd.textContent = last + 's';
  }

  function pushChartPoint() {
    var pct = totalAgentes > 0 ? (evacuados / totalAgentes) * 100 : 0;
    evacHistory.push({ t: elapsedSeconds, pct: pct });
    if (evacHistory.length > MAX_CHART_POINTS) evacHistory.shift();
    renderChart();
    updateXAxisLabels();
  }

  function resetChart() {
    evacHistory = [];
    renderChart();
    updateXAxisLabels();
  }

  function setStatus(newState) {
    state = newState;
    statusDot.classList.remove('running', 'paused', 'stopped');

    if (state === STATE.RUNNING) {
      statusDot.classList.add('running');
      statusText.textContent = 'Simulação em execução';
      btnIniciar.textContent = 'Simulação rodando';
      btnPausar.textContent = '⏸ Pausar';
    } else if (state === STATE.PAUSED) {
      statusDot.classList.add('paused');
      statusText.textContent = 'Simulação pausada';
      btnIniciar.textContent = '▶ Retomar simulação';
      btnPausar.textContent = 'Simulação pausada';
    } else {
      statusDot.classList.add('stopped');
      statusText.textContent = 'Simulação parada';
      if (!btnIniciar.disabled) btnIniciar.textContent = '▶ Iniciar simulação';
      btnPausar.textContent = '⏸ Pausar';
    }
  }

  var agentMarkersMap = new Map();

  function clearAgentMarkers() {
    agentMarkersMap.forEach(function (marker) {
      agentsLayer.removeLayer(marker);
    });
    agentMarkersMap.clear();
  }

  function updateAgentMarkers() {
    var isRunning = (state === STATE.RUNNING);
    var activeAgentIds = new Set();
    agents.forEach(function (ag) {
      if (!ag.evacuated) activeAgentIds.add(ag.id);
    });

    agentMarkersMap.forEach(function (marker, id) {
      if (!activeAgentIds.has(id)) {
        agentsLayer.removeLayer(marker);
        agentMarkersMap.delete(id);
      }
    });

    agents.forEach(function (ag) {
      if (ag.evacuated) return;
      var p = (ag.lat !== undefined && ag.lng !== undefined) ? { lat: ag.lat, lng: ag.lng } : xyToLatLng(ag.x, ag.y);

      if (!agentMarkersMap.has(ag.id)) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="agent' + (isRunning ? ' walking' : '') + '"></div>',
          iconSize: [11, 11],
          iconAnchor: [5.5, 5.5]
        });
        var marker = L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(agentsLayer);
        agentMarkersMap.set(ag.id, marker);
      } else {
        var marker = agentMarkersMap.get(ag.id);
        marker.setLatLng([p.lat, p.lng]);

        var el = marker.getElement();
        if (el) {
          var agentDiv = el.querySelector('.agent');
          if (agentDiv) {
            if (isRunning) agentDiv.classList.add('walking');
            else agentDiv.classList.remove('walking');
          }
        }
      }
    });
  }

  var lastAnimTime = null;

  function animateLoop(timestamp) {
    if (!lastAnimTime) lastAnimTime = timestamp;
    var dt = (timestamp - lastAnimTime) / 1000;
    lastAnimTime = timestamp;
    if (dt > 0.1) dt = 0.1;

    if (state === STATE.RUNNING) {
      // Progresso de uma aresta por segundo. Com a velocidade padrão (1,5×),
      // uma conexão é percorrida em ~0,9 s; antes eram ~8,3 s e o movimento
      // praticamente não era perceptível no mapa.
      var stepRate = 0.75 * speed * dt;

      agents.forEach(function (ag) {
        if (ag.evacuated) return;

        if (!ag.path || ag.path.length <= 1 || ag.pathIndex >= ag.path.length - 1) {
          var nEvac = getNode(ag.currentNodeId);
          if (nEvac && nEvac.type === 'exit') {
            ag.evacuated = true;
            evacuados++;
            addLog('<span class="hl">Agente evacuou via ponto seguro ' + nEvac.name + ' 🚪</span>');
          } else {
            var newRes = findPath(ag.currentNodeId, true);
            if (newRes && newRes.path.length > 1) {
              ag.path = newRes.path;
              ag.pathIndex = 0;
              ag.segmentProgress = 0;
              ag.trapped = false;
            } else {
              ag.trapped = true;
            }
          }
          return;
        }

        ag.segmentProgress += stepRate;
        if (ag.segmentProgress >= 1) {
          ag.segmentProgress = 0;
          ag.pathIndex++;
          ag.currentNodeId = ag.path[ag.pathIndex];

          var currNode = getNode(ag.currentNodeId);
          if (currNode) {
            ag.lat = currNode.lat;
            ag.lng = currNode.lng;
            ag.x = currNode.x;
            ag.y = currNode.y;
            if (currNode.type === 'exit') {
              ag.evacuated = true;
              evacuados++;
              addLog('<span class="hl">Agente evacuou via ponto seguro ' + currNode.name + ' 🚪</span>');
            }
          }
        }

        if (!ag.evacuated && ag.path && ag.pathIndex < ag.path.length - 1) {
          var nFrom = getNode(ag.path[ag.pathIndex]);
          var nTo   = getNode(ag.path[ag.pathIndex + 1]);
          if (nFrom && nTo) {
            ag.lat = nFrom.lat + (nTo.lat - nFrom.lat) * ag.segmentProgress;
            ag.lng = nFrom.lng + (nTo.lng - nFrom.lng) * ag.segmentProgress;
            ag.x = nFrom.x + (nTo.x - nFrom.x) * ag.segmentProgress;
            ag.y = nFrom.y + (nTo.y - nFrom.y) * ag.segmentProgress;
          }
        }
      });

      var remainingAgents = agents.filter(function (ag) { return !ag.evacuated; });
      var allRemainingTrapped = remainingAgents.length > 0 && remainingAgents.every(function (ag) { return ag.trapped; });

      if (evacuados >= totalAgentes) {
        addLog('<span class="hl">Todos os ' + totalAgentes + ' agentes foram evacuados com sucesso!</span>');
        stopTimer();
        setStatus(STATE.STOPPED);
      } else if (allRemainingTrapped) {
        addLog('<span class="warn">Simulação encerrada: ' + remainingAgents.length + ' agente(s) sem rota de evacuação.</span>');
        stopTimer();
        setStatus(STATE.STOPPED);
      }

      updateStatsDisplay();
    }

    updateAgentMarkers();

    requestAnimationFrame(animateLoop);
  }

  requestAnimationFrame(animateLoop);

  async function tick() {
    if (state !== STATE.RUNNING) return;
    elapsedSeconds += 1;
    var fireSpreadRate = fireSpreadInput ? parseFloat(fireSpreadInput.value) : 1;
    if (fireSpreadRate > 0 && elapsedSeconds % Math.max(2, Math.round(5 / fireSpreadRate)) === 0) {
      spreadFire();
    }
    // A animação avança continuamente no requestAnimationFrame. Recalcular
    // aqui reiniciava pathIndex e segmentProgress a cada tick, impedindo que
    // qualquer agente terminasse a primeira aresta. Rotas só são refeitas
    // quando o grafo realmente muda (incêndio, bloqueio, saída ou reinício).
    pushChartPoint();
  }

  function startTimer() {
    stopTimer();
    var intervalMs = Math.max(250, 800 / speed);
    tickTimer = setInterval(tick, intervalMs);
  }

  function stopTimer() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  /* ---------- 10. BOTÕES DE CONTROLE ---------- */
  btnIniciar.addEventListener('click', function () {
    if (state === STATE.RUNNING) return;
    if (state === STATE.STOPPED) addLog('Simulação iniciada — ' + totalAgentes + ' agentes');
    else addLog('Simulação retomada');

    setStatus(STATE.RUNNING);
    startTimer();
  });

  btnPausar.addEventListener('click', function () {
    if (state !== STATE.RUNNING) return;
    stopTimer();
    setStatus(STATE.PAUSED);
    addLog('Simulação pausada');
  });

  btnReiniciar.addEventListener('click', async function () {
    stopTimer();
    evacuados = 0;
    elapsedSeconds = 0;
    nodes = JSON.parse(JSON.stringify(apiInitialNodes));
    edges = JSON.parse(JSON.stringify(apiInitialEdges));
    activeFires = [];
    totalAgentes = 50;

    clearAgentMarkers();
    randomizeExits();
    initAgents();
    await recalculateAllAgentPathsAsync();

    fieldAgentes.textContent = totalAgentes;
    statTotal.textContent = totalAgentes;
    updateStatsDisplay();
    setStatus(STATE.STOPPED);
    resetLog();
    resetChart();

    toolButtons.forEach(function (b) { b.classList.remove('active'); });
    mapCanvas.classList.remove('tool-active');
    activeTool = null;

    renderGraph();
  });

  /* ---------- 11. FERRAMENTAS DO MAPA ---------- */
  var activeTool = null;

  toolButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tool = btn.dataset.tool;
      if (activeTool === tool) {
        activeTool = null;
        btn.classList.remove('active');
        mapCanvas.classList.remove('tool-active');
        return;
      }
      toolButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeTool = tool;
      mapCanvas.classList.add('tool-active');

      var toolNames = {
        bloqueio: 'Adicionar bloqueio (🔥)',
        saida: 'Marcar saída segura (🚪)',
        pessoa: 'Adicionar pessoa (🧍)'
      };
      addLog('Ferramenta ativa: ' + toolNames[tool] + ' — clique no mapa');
    });
  });

  leafletMap.on('click', async function (evt) {
    if (!activeTool) return;

    var xy = latLngToXY(evt.latlng.lat, evt.latlng.lng);
    var x = xy.x;
    var y = xy.y;

    if (activeTool === 'bloqueio') {
      // Cada clique cria um risco próprio. Antes, cliques próximos de um nó
      // existente eram agrupados nele e pareciam não registrar bloqueio algum.
      var snapBlock = snapToNearestStreet(evt.latlng.lat, evt.latlng.lng);
      var newId = 'NB' + (nodes.length + 1);
      var newFireNode = {
        id: newId,
        name: 'Bloqueio em ' + safeNodeName(getNode(snapBlock.fromNodeId), 'via'),
        lat: snapBlock.lat,
        lng: snapBlock.lng,
        x: snapBlock.x,
        y: snapBlock.y,
        type: 'blocked'
      };
      nodes.push(newFireNode);
      var blockedSegments = blockStreetAtSnap(snapBlock);
      igniteFireAtNode(newFireNode, 'manual');
      if (blockedSegments > 0) {
        addLog('<span class="warn">TRECHO DA VIA BLOQUEADO — agentes procurando desvio</span>');
      } else {
        addLog('<span class="warn">BLOQUEIO REGISTRADO FORA DE UMA VIA CONECTADA</span>');
      }
      // Mostra o bloqueio imediatamente, antes de aguardar o recálculo de rotas.
      renderGraph();
      await recalculateAllAgentPathsAsync();

    } else if (activeTool === 'saida') {
      var newExitId = 'NE' + (nodes.length + 1);
      nodes.push({
        id: newExitId,
        name: 'Nova Saída (' + Math.round(x) + ',' + Math.round(y) + ')',
        lat: evt.latlng.lat,
        lng: evt.latlng.lng,
        x: x,
        y: y,
        type: 'exit'
      });

      var nearest = null;
      var minD = Infinity;
      nodes.forEach(function (n) {
        if (n.id !== newExitId && n.type !== 'blocked') {
          var d = Math.hypot(n.x - x, n.y - y);
          if (d < minD) { minD = d; nearest = n; }
        }
      });
      if (nearest) {
        // A malha OSM usa arestas direcionadas. A saída precisa receber uma
        // ligação vinda da rua (para ser encontrada pelo A*) e manter o
        // retorno para que a conexão continue utilizável em ambos os sentidos.
        var exitAccessWeight = Math.max(1, Math.round(minD));
        edges.push(
          { from: nearest.id, to: newExitId, weight: exitAccessWeight, name: 'Acesso Saída', directed: true },
          { from: newExitId, to: nearest.id, weight: exitAccessWeight, name: 'Acesso Saída', directed: true }
        );
      }
      addLog('<span class="hl">Nova saída segura cadastrada</span>');
      // A saída é visível no instante do clique, mesmo enquanto a rota é recalculada.
      renderGraph();
      await recalculateAllAgentPathsAsync();

    } else if (activeTool === 'pessoa') {
      if (totalAgentes >= MAX_AGENTES) {
        addLog('<span class="warn">Limite máximo de ' + MAX_AGENTES + ' agentes atingido</span>');
        return;
      }
      totalAgentes += 1;
      var snap = snapToNearestStreet(evt.latlng.lat, evt.latlng.lng);
      // O agente é inserido exatamente onde foi clicado. Quando o ponto está
      // perto de uma rua, criamos um nó de acesso; caso não haja rota, ele
      // continua visível e entra na estatística de agentes presos.
      var startId = 'NP' + (nodes.length + 1);
      var nearestDistance = Math.hypot(evt.latlng.lat - snap.lat, evt.latlng.lng - snap.lng);
      var isNearStreet = snap.fromNodeId && snap.toNodeId && nearestDistance < 0.00025;
      nodes.push({
        id: startId,
        name: 'Agente ' + totalAgentes,
        lat: evt.latlng.lat,
        lng: evt.latlng.lng,
        x: x,
        y: y,
        type: 'normal',
        temporary: true
      });
      if (isNearStreet) {
        var accessWeight = Math.max(1, Math.round(Math.hypot(x - snap.x, y - snap.y)));
        edges.push(
          { from: startId, to: snap.fromNodeId, weight: accessWeight, name: 'Acesso do agente', directed: true },
          { from: startId, to: snap.toNodeId, weight: accessWeight, name: 'Acesso do agente', directed: true }
        );
      }
      var newAgent = createAgent(totalAgentes, startId);
      // createAgent evita origens sem saída para a população inicial. Para um
      // clique manual, preserve o ponto escolhido mesmo quando ele é isolado.
      newAgent.currentNodeId = startId;
      newAgent.lat = evt.latlng.lat;
      newAgent.lng = evt.latlng.lng;
      newAgent.x = x;
      newAgent.y = y;
      var manualPath = findPath(startId, true);
      newAgent.path = manualPath ? manualPath.path : [startId];
      newAgent.pathIndex = 0;
      newAgent.segmentProgress = 0;
      newAgent.trapped = !manualPath;
      agents.push(newAgent);

      fieldAgentes.textContent = totalAgentes;
      statTotal.textContent = totalAgentes;
      addLog(newAgent.trapped
        ? '<span class="warn">Agente inserido sem rota de evacuação</span>'
        : 'Novo agente posicionado com rota de evacuação');
      await recalculateAllAgentPathsAsync();
      updateStatsDisplay();
    }

    renderGraph();
  });

  function igniteFireAtNode(node, source) {
    if (!node) return;
    node.type = 'blocked';
    var intensity = fireIntensityInput ? parseFloat(fireIntensityInput.value) : 2;
    var spread = fireSpreadInput ? parseFloat(fireSpreadInput.value) : 1;
    var exists = activeFires.some(function (fire) { return fire.nodeId === node.id; });
    if (!exists) {
      activeFires.push({
        nodeId: node.id,
        x: node.x,
        y: node.y,
        radius: 34 + intensity * 15,
        intensity: intensity,
        spread: spread
      });
    }
    var streetName = node.name;
    edges.some(function (e) {
      if (e.from === node.id || e.to === node.id) {
        streetName = e.name;
        return true;
      }
      return false;
    });
    addLog('<span class="warn">INCÊNDIO DETECTADO NA ' + streetName.toUpperCase() + '</span>');
    if (source === 'spread') addLog('<span class="warn">FOGO SE ESPALHOU PARA ' + node.name.toUpperCase() + '</span>');
    forceRecalculateForFire(node.id);
  }

  /* ---------- 12. SLIDER DE VELOCIDADE ---------- */
  var speedTrack = document.getElementById('speed-track');
  var speedFill  = document.getElementById('speed-fill');
  var speedThumb = document.getElementById('speed-thumb');
  var speedLabel = document.getElementById('speed-label');

  var SPEED_MIN = 0.5;
  var SPEED_MAX = 3.0;

  function applySpeed(v) {
    speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, v));
    var pct = ((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100;
    speedFill.style.width = pct + '%';
    speedThumb.style.left = pct + '%';
    speedLabel.textContent = speed.toFixed(1) + '×';

    if (state === STATE.RUNNING) startTimer();
  }

  function percentFromEvent(evt) {
    var rect = speedTrack.getBoundingClientRect();
    var clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    var p = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, p));
  }

  var dragging = false;
  function startDrag(evt) { dragging = true; moveDrag(evt); evt.preventDefault(); }
  function moveDrag(evt) {
    if (!dragging) return;
    var pct = percentFromEvent(evt);
    applySpeed(SPEED_MIN + (pct / 100) * (SPEED_MAX - SPEED_MIN));
  }
  function endDrag() { dragging = false; }

  speedThumb.addEventListener('mousedown', startDrag);
  speedTrack.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('mouseup', endDrag);

  if (fireIntensityInput) {
    fireIntensityInput.addEventListener('input', function () {
      fireIntensityLabel.textContent = parseFloat(fireIntensityInput.value).toFixed(1) + '×';
      activeFires.forEach(function (fire) {
        fire.intensity = parseFloat(fireIntensityInput.value);
        fire.radius = 34 + fire.intensity * 15;
      });
      recalculateAllAgentPaths();
      renderGraph();
    });
  }

  if (fireSpreadInput) {
    fireSpreadInput.addEventListener('input', function () {
      fireSpreadLabel.textContent = parseFloat(fireSpreadInput.value).toFixed(1) + '×';
      activeFires.forEach(function (fire) { fire.spread = parseFloat(fireSpreadInput.value); });
    });
  }

  /* ---------- 13. INICIALIZAÇÃO ---------- */
  async function initApp() {
    window.addEventListener('resize', function () { leafletMap.invalidateSize(); });
    setTimeout(function () { leafletMap.invalidateSize(); }, 100);

    var apiGraph = null;
    try {
      var response = await fetch(
        getApiUrl(
          '/api/graph' +
          '?south=' + GEO_BOUNDS.south +
          '&west=' + GEO_BOUNDS.west +
          '&north=' + GEO_BOUNDS.north +
          '&east=' + GEO_BOUNDS.east
        )
      );
      if (response.ok) {
        var data = await response.json();
        if (data && data.nodes && data.edges) {
          apiGraph = data;
        }
      }
    } catch (e) {
      console.warn('API local indisponível; tentando Overpass diretamente', e);
    }

    // Em algumas redes, o processo Node não tem saída para a internet, mas o
    // navegador tem. Quando /api/graph falhar, tente o Overpass diretamente.
    if (!apiGraph) {
      try {
        apiGraph = await fetchGraphFromOverpass();
        addLog('Grafo do bairro carregado diretamente do OpenStreetMap');
      } catch (e) {
        console.warn('OpenStreetMap indisponível; usando malha de contingência', e);
        addLog('<span class="warn">API de ruas indisponível — simulação não iniciada</span>');
      }
    }

    if (apiGraph && apiGraph.nodes.length > 0 && apiGraph.edges.length > 0) {
      var normalizedGraph = normalizeApiGraph(apiGraph);
      apiInitialNodes = normalizedGraph.nodes;
      apiInitialEdges = normalizedGraph.edges;
      nodes = JSON.parse(JSON.stringify(apiInitialNodes));
      edges = JSON.parse(JSON.stringify(apiInitialEdges));
      addLog('Malha viária da API aplicada: ' + nodes.length + ' nós e ' + edges.length + ' segmentos');
    } else {
      btnIniciar.disabled = true;
      btnReiniciar.disabled = true;
      btnIniciar.textContent = 'API indisponível';
      fitMapToScenarioBounds();
      setStatus(STATE.STOPPED);
      renderGraph();
      return;
    }

    fitMapToScenarioBounds();
    // O Leaflet só conhece o tamanho final do painel depois do primeiro layout.
    // Repetir o enquadramento aqui evita manter o zoom inicial mais amplo.
    setTimeout(fitMapToScenarioBounds, 0);

    applySpeed(1.5);
    randomizeExits();
    initAgents();
    await recalculateAllAgentPathsAsync();
    setStatus(STATE.STOPPED);
    updateStatsDisplay();
    pushChartPoint();
    renderGraph();
  }

  initApp();

})();
