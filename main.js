// ============================================================
// URBANISA TECH — SmartEvac Liberdade
// Engine de Simulação & Algoritmos de Busca (A* e Dijkstra)
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
  var statCusto     = document.getElementById('stat-custo');
  var statFireAstar = document.getElementById('stat-fire-astar');
  var statFireDijkstra = document.getElementById('stat-fire-dijkstra');
  var fieldAgentes  = document.getElementById('field-agentes');

  var logList          = document.getElementById('log-list');
  var mapCanvas        = document.getElementById('map-canvas');
  var overlayContainer = document.getElementById('overlay-container');
  var mapToolbar       = document.getElementById('map-toolbar');

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
    '<span class="warn">Bloqueio em R. Galvão Bueno (Viaduto Osaka)</span>',
    'Agentes calculando rota via A*',
    '<span class="hl">Agente evacuou via Metrô Liberdade</span>'
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
  var MODEL_BOUNDS = { minX: 40, maxX: 440, minY: 40, maxY: 360 };
  var GEO_BOUNDS = { south: -23.5650, north: -23.5530, west: -46.6420, east: -46.6280 };

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

  // "Efeito parede": o usuário pode navegar dentro da Liberdade, mas não sai da área
  var WALL_BOUNDS = L.latLngBounds(
    L.latLng(GEO_BOUNDS.south - 0.0025, GEO_BOUNDS.west - 0.0025),
    L.latLng(GEO_BOUNDS.north + 0.0025, GEO_BOUNDS.east + 0.0025)
  );

  var leafletMap = L.map('leaflet-map', {
    center: [(GEO_BOUNDS.north + GEO_BOUNDS.south) / 2, (GEO_BOUNDS.west + GEO_BOUNDS.east) / 2],
    zoom: 16,
    minZoom: 15,
    maxZoom: 19,
    maxBounds: WALL_BOUNDS,
    maxBoundsViscosity: 1.0
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);

  // Camadas redesenhadas a cada frame da simulação
  var streetsLayer  = L.layerGroup().addTo(leafletMap); // arestas do grafo (ruas)
  var nodesLayer     = L.layerGroup().addTo(leafletMap); // cruzamentos / saídas / bloqueios
  var routesLayer    = L.layerGroup().addTo(leafletMap); // rotas calculadas pelo A*
  var agentsLayer    = L.layerGroup().addTo(leafletMap); // pessoas em evacuação
  var costTagsLayer  = L.layerGroup().addTo(leafletMap); // rótulos f(n)/g(n)/h(n)
  var landmarksLayer = L.layerGroup().addTo(leafletMap); // marcos turísticos (estáticos)

  /* ---------- 4. GRAFO REALISTA DO BAIRRO DA LIBERDADE ---------- */
  var INITIAL_NODES = [
    { id: 'N1', name: 'R. Galvão Bueno (Norte)', lat: -23.5552, lng: -46.6353, x: 60, y: 90, type: 'normal' },
    { id: 'N2', name: 'Cruzamento Galvão x Estudantes', lat: -23.5566, lng: -46.6347, x: 210, y: 95, type: 'normal' },
    { id: 'N3', name: 'Estação Metrô Liberdade 🚇', lat: -23.5553, lng: -46.6357, x: 340, y: 70, type: 'exit' },
    { id: 'N4', name: 'Viaduto Cidade de Osaka 🌉', lat: -23.5559, lng: -46.6350, x: 140, y: 60, type: 'blocked' },
    { id: 'N5', name: 'Rua dos Estudantes (Oeste)', lat: -23.5564, lng: -46.6356, x: 90, y: 260, type: 'normal' },
    { id: 'N6', name: 'Cruzamento Galvão x Américo', lat: -23.5574, lng: -46.6344, x: 200, y: 200, type: 'normal' },
    { id: 'N7', name: 'Praça da Liberdade 🏙️', lat: -23.5557, lng: -46.6360, x: 300, y: 180, type: 'exit' },
    { id: 'N8', name: 'Rua da Glória (Sul)', lat: -23.5573, lng: -46.6343, x: 160, y: 230, type: 'normal' },
    { id: 'N9', name: 'Rua Américo de Campos', lat: -23.5575, lng: -46.6335, x: 270, y: 270, type: 'normal' },
    { id: 'N10', name: 'Avenida Liberdade 🚦', lat: -23.5574, lng: -46.6362, x: 420, y: 130, type: 'exit' },
    { id: 'N11', name: 'Rua Conselheiro Furtado', lat: -23.5571, lng: -46.6325, x: 380, y: 230, type: 'normal' },
    { id: 'N12', name: 'Rua São Joaquim', lat: -23.5587, lng: -46.6341, x: 110, y: 340, type: 'normal' }
  ];

  var INITIAL_EDGES = [
    { from: 'N1', to: 'N4', weight: 80, name: 'R. Galvão Bueno' },
    { from: 'N4', to: 'N2', weight: 75, name: 'R. Galvão Bueno' },
    { from: 'N2', to: 'N3', weight: 130, name: 'Praça da Liberdade' },
    { from: 'N1', to: 'N5', weight: 170, name: 'R. Tomás de Lima' },
    { from: 'N5', to: 'N8', weight: 75, name: 'R. dos Estudantes' },
    { from: 'N8', to: 'N6', weight: 50, name: 'R. dos Estudantes' },
    { from: 'N6', to: 'N7', weight: 100, name: 'R. Américo de Campos' },
    { from: 'N2', to: 'N6', weight: 105, name: 'R. Galvão Bueno' },
    { from: 'N6', to: 'N9', weight: 90, name: 'R. Américo de Campos' },
    { from: 'N9', to: 'N7', weight: 95, name: 'R. da Glória' },
    { from: 'N3', to: 'N10', weight: 100, name: 'Av. Liberdade' },
    { from: 'N7', to: 'N10', weight: 130, name: 'Av. Liberdade' },
    { from: 'N7', to: 'N11', weight: 95, name: 'R. Cons. Furtado' },
    { from: 'N5', to: 'N12', weight: 85, name: 'R. São Joaquim' },
    { from: 'N8', to: 'N12', weight: 120, name: 'R. São Joaquim' }
  ];

  var LANDMARKS = [
    { text: '🏮 Portal Liberdade', x: 60, y: 90 },
    { text: '🚇 Metrô Liberdade', x: 340, y: 70 },
    { text: '🏙️ Praça da Liberdade', x: 300, y: 180 },
    { text: '🌉 Viaduto Osaka', x: 140, y: 60 }
  ];

  var nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
  var edges = JSON.parse(JSON.stringify(INITIAL_EDGES));
  var activeFires = [];
  var lastFireComparison = null;

  // Marcos turísticos não mudam de posição — desenhamos uma única vez sobre o mapa real
  LANDMARKS.forEach(function (lm) {
    var p = xyToLatLng(lm.x, lm.y);
    var icon = L.divIcon({
      className: '',
      html: '<div class="landmark-badge">' + lm.text + '</div>',
      iconSize: null
    });
    L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(landmarksLayer);
  });

  function getNode(id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  function getNeighbors(nodeId) {
    var list = [];
    edges.forEach(function (e) {
      if (e.from === nodeId) {
        var target = getNode(e.to);
        if (target && target.type !== 'blocked') list.push({ node: target, weight: e.weight });
      } else if (e.to === nodeId) {
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

  /* ---------- 5. MOTOR DE BUSCA (A* e Dijkstra) ---------- */
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
  var activeTab = 'tab-mapa';

  var tickTimer = null;
  var agents = [];

<<<<<<< HEAD
  function measurePath(startId, useHeuristic) {
    var t0 = performance.now();
    var res = findPath(startId, useHeuristic);
    var responseMs = Math.max(1, Math.round((performance.now() - t0) * 1000) / 1000);
    return {
      responseMs: responseMs,
      nodesExplored: res ? res.nodesExplored : 0,
      cost: res ? res.cost : 0
    };
  }

  function updateFireComparison(startId) {
    var astar = measurePath(startId || 'N1', true);
    var dijkstra = measurePath(startId || 'N1', false);
    lastFireComparison = { astar: astar, dijkstra: dijkstra };
    if (statFireAstar && activeFires.length > 0) {
      statFireAstar.textContent = astar.responseMs + 'ms · ' + astar.nodesExplored + ' nós';
    }
    if (statFireDijkstra && activeFires.length > 0) {
      statFireDijkstra.textContent = dijkstra.responseMs + 'ms · ' + dijkstra.nodesExplored + ' nós';
    }
  }

  function createAgent(id, startNodeId) {
    var normalNodes = nodes.filter(function (n) { return n.type === 'normal'; });
    if (!startNodeId) {
      var randNode = normalNodes[Math.floor(Math.random() * normalNodes.length)];
      startNodeId = randNode ? randNode.id : 'N1';
=======
  function snapToNearestStreet(lat, lng) {
    var minDistance = Infinity;
    var bestPoint = { lat: lat, lng: lng, x: 0, y: 0, fromNodeId: 'N1', toNodeId: 'N2', progress: 0 };

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

    var validCandidates = nodes.filter(function (n) { return n.type === 'normal'; });
    if (validCandidates.length === 0) return;

    for (var i = validCandidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = validCandidates[i];
      validCandidates[i] = validCandidates[j];
      validCandidates[j] = temp;
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50
    }

    var numExits = Math.min(3, validCandidates.length);
    for (var k = 0; k < numExits; k++) {
      validCandidates[k].type = 'exit';
    }

    addLog('<span class="hl">Saídas de emergência sorteadas aleatoriamente nas ruas</span>');
  }

  function createAgent(id, startNodeId) {
    var validEdges = edges.filter(function (e) {
      var n1 = getNode(e.from);
      var n2 = getNode(e.to);
      return n1 && n2 && n1.type !== 'blocked' && n2.type !== 'blocked';
    });

    if (validEdges.length === 0 || startNodeId) {
      var normalNodes = nodes.filter(function (n) { return n.type === 'normal'; });
      var randNode = getNode(startNodeId) || normalNodes[Math.floor(Math.random() * normalNodes.length)] || nodes[0];
      var startId = randNode ? randNode.id : 'N1';
      var res0 = findPath(startId, true);
      return {
        id: id,
        currentNodeId: startId,
        path: res0 ? res0.path : [startId],
        pathIndex: 0,
        segmentProgress: 0,
        x: randNode.x,
        y: randNode.y,
        evacuated: false
      };
    }

    var randEdge = validEdges[Math.floor(Math.random() * validEdges.length)];
    var nFrom = getNode(randEdge.from);
    var nTo = getNode(randEdge.to);
    var t = Math.random();

    var posLat = nFrom.lat + (nTo.lat - nFrom.lat) * t;
    var posLng = nFrom.lng + (nTo.lng - nFrom.lng) * t;
    var posX = nFrom.x + (nTo.x - nFrom.x) * t;
    var posY = nFrom.y + (nTo.y - nFrom.y) * t;

    var startId = t >= 0.5 ? randEdge.to : randEdge.from;
    var res = findPath(startId, true);

    return {
      id: id,
      currentNodeId: startId,
      path: res ? res.path : [startId],
      pathIndex: 0,
      segmentProgress: t,
      lat: posLat,
      lng: posLng,
      x: posX,
      y: posY,
      evacuated: false
    };
  }

  function initAgents() {
    agents = [];
    for (var i = 1; i <= totalAgentes; i++) {
      agents.push(createAgent(i));
    }
  }

  function getDynamicGraphPayload() {
    var baseNodeIds = new Set(INITIAL_NODES.map(function (n) { return n.id; }));
    var baseEdgeKeys = new Set(INITIAL_EDGES.map(function (e) { return e.from + '-' + e.to; }));

    var dynamicNodes = nodes.filter(function (n) { return !baseNodeIds.has(n.id) || n.type === 'blocked'; });
    var dynamicEdges = edges.filter(function (e) { return !baseEdgeKeys.has(e.from + '-' + e.to); });
    var blockedIds = nodes.filter(function (n) { return n.type === 'blocked'; }).map(function (n) { return n.id; });

    return {
      dynamicNodes: dynamicNodes,
      dynamicEdges: dynamicEdges,
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
        totalExploredSum += res.nodesExplored;
        totalCostSum += res.cost;
        validCount++;
      }
    });

    if (validCount > 0) {
      statNos.textContent = Math.round(totalExploredSum / validCount);
      statCusto.textContent = (totalCostSum / validCount).toFixed(1);
    }
    updateFireComparison(validCount > 0 ? agents[0].currentNodeId : 'N1');
  }

  function forceRecalculateForFire(nodeId) {
    updateFireComparison(nodeId);
    addLog('<span class="warn">AGENTES RECALCULANDO ROTA VIA A*</span>');
    recalculateAllAgentPaths();
  }

  function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8080')) {
      return 'http://localhost:8080' + endpoint;
    }
    return endpoint;
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
              totalExploredSum += res.nodesExplored;
              totalCostSum += res.cost;
              validCount++;
            }
          });

          if (validCount > 0) {
            statNos.textContent = Math.round(totalExploredSum / validCount);
            statCusto.textContent = (totalCostSum / validCount).toFixed(1);
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
    routesLayer.clearLayers();
    agentsLayer.clearLayers();

    // Desenhos traçados de ruas e rotas sobre o mapa foram removidos
    // para exibir o mapa limpo com marcadores e agentes.

    // Pré-calcula os resultados de busca usados para colorir os nós (evita recalcular por nó)
    var sampleResNos = activeTab === 'tab-nos' ? findPath('N1', true) : null;
    var astarResComp = activeTab === 'tab-comparar' ? findPath('N1', true) : null;
    var dijkResComp  = activeTab === 'tab-comparar' ? findPath('N1', false) : null;

    // Desenha os nós (cruzamentos / saídas / bloqueios) como marcadores reais
    nodes.forEach(function (n) {
<<<<<<< HEAD
      var el = document.createElement('div');
      el.className = 'node ' + (n.type !== 'normal' ? n.type : '');
      if (getFireDangerAtNode(n) > 0) el.classList.add('fire-active');
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.title = n.name;
=======
      var classes = ['node'];
      if (n.type !== 'normal') classes.push(n.type);
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50

      if (activeTab === 'tab-nos' && sampleResNos) {
        if (sampleResNos.openSet.indexOf(n.id) !== -1) classes.push('open-set');
        else if (sampleResNos.closedSet.indexOf(n.id) !== -1) classes.push('closed-set');
      } else if (activeTab === 'tab-comparar') {
        if (astarResComp && astarResComp.closedSet.indexOf(n.id) !== -1) classes.push('closed-set');
        else if (dijkResComp && dijkResComp.closedSet.indexOf(n.id) !== -1) classes.push('dijkstra-visited');
      }

      var p = xyToLatLng(n.x, n.y);
      var icon = L.divIcon({
        className: '',
        html: '<div class="' + classes.join(' ') + '" title="' + n.name.replace(/"/g, '&quot;') + '"></div>',
        iconSize: [13, 13],
        iconAnchor: [6.5, 6.5]
      });

      // interactive:false faz o clique "atravessar" o marcador e chegar até o mapa —
      // é isso que permite clicar em cima de um nó para bloqueá-lo, por exemplo.
      L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(nodesLayer);
    });

    // Desenha os agentes (pessoas evacuando) em tempo real nas ruas do Leaflet
    updateAgentMarkers();

    renderActiveTabOverlay();
  }

  function renderActiveTabOverlay() {
    overlayContainer.innerHTML = '';
<<<<<<< HEAD
    activeFires.forEach(function (fire) {
      var zone = document.createElement('div');
      zone.className = 'fire-zone';
      zone.style.left = fire.x + 'px';
      zone.style.top = fire.y + 'px';
      zone.style.width = (fire.radius * 2) + 'px';
      zone.style.height = (fire.radius * 2) + 'px';
      overlayContainer.appendChild(zone);
    });
=======
    costTagsLayer.clearLayers();
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50

    if (activeTab === 'tab-custo') {
      var res = findPath('N1', true);
      if (res) {
        nodes.forEach(function (n) {
          if (n.type === 'blocked') return;
          var g = res.gScore[n.id];
          var f = res.fScore[n.id];
          var h = f !== Infinity && g !== Infinity ? (f - g) : 0;
          if (g === Infinity) return;

<<<<<<< HEAD
          var tag = document.createElement('div');
          tag.className = 'cost-tag';
          tag.style.left = n.x + 'px';
          tag.style.top = n.y + 'px';
          var smoke = getFireDangerAtNode(n);
          tag.innerHTML = 'f:' + Math.round(f) + ' (g:' + Math.round(g) + '+h:' + Math.round(h) + ')' + (smoke > 0 ? '<br>fumaça +' + smoke.toFixed(1) + '×' : '');
          overlayContainer.appendChild(tag);
=======
          var p = xyToLatLng(n.x, n.y);
          var icon = L.divIcon({
            className: '',
            html: '<div class="cost-tag">f:' + Math.round(f) + ' (g:' + Math.round(g) + '+h:' + Math.round(h) + ')</div>',
            iconSize: null
          });
          L.marker([p.lat, p.lng], { icon: icon, interactive: false }).addTo(costTagsLayer);
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50
        });
      }

      var card = document.createElement('div');
      card.className = 'overlay-card';
      card.innerHTML = '<div style="font-weight:700; color:var(--cyan); margin-bottom:4px;">Análise do Custo f(n) = g(n) + h(n)</div>' +
        '<div style="font-size:12px; color:var(--text-muted);">' +
        'Cada nó exibe o custo de rota percorrido <strong>g(n)</strong> somado à heurística Euclidiana <strong>h(n)</strong>. O A* sempre expande primeiro o nó com menor <strong>f(n)</strong>.' +
        '</div>';
      overlayContainer.appendChild(card);

    } else if (activeTab === 'tab-nos') {
      var astarSample = findPath('N1', true);
      var nodesExploredCount = astarSample ? astarSample.nodesExplored : 0;
      var totalGraphNodes = nodes.length;
      var savingsPct = (((totalGraphNodes - nodesExploredCount) / totalGraphNodes) * 100).toFixed(1);

      var cardNos = document.createElement('div');
      cardNos.className = 'overlay-card';
      cardNos.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
        '<span style="font-weight:700; color:var(--amber);">Espaço de Busca — A*</span>' +
        '<span class="badge-savings">' + savingsPct + '% de nós poupados</span>' +
        '</div>' +
        '<div style="font-size:12px; color:var(--text-muted); line-height:1.5;">' +
        '• <span style="color:var(--amber); font-weight:600;">Amarelo</span>: Fila de Prioridade (Open Set)<br>' +
        '• <span style="color:var(--purple); font-weight:600;">Roxo</span>: Nós já avaliados e expandidos (Closed Set: ' + nodesExploredCount + '/' + totalGraphNodes + ' nós)' +
        '</div>';
      overlayContainer.appendChild(cardNos);

    } else if (activeTab === 'tab-comparar') {
      var astarRes = findPath('N1', true);
      var dijkstraRes = findPath('N1', false);

      var astarNodes = astarRes ? astarRes.nodesExplored : 0;
      var dijkstraNodes = dijkstraRes ? dijkstraRes.nodesExplored : 0;
      var astarCost = astarRes ? Math.round(astarRes.cost) : 0;
      var dijkstraCost = dijkstraRes ? Math.round(dijkstraRes.cost) : 0;

      var nodeDiff = dijkstraNodes > 0 ? Math.round(((dijkstraNodes - astarNodes) / dijkstraNodes) * 100) : 0;

      var cardComp = document.createElement('div');
      cardComp.className = 'overlay-card';
      cardComp.innerHTML = '<div style="font-weight:700; color:var(--text); margin-bottom:6px;">' +
        'Comparativo para a Banca Julgadora: A* vs. Dijkstra' +
        '</div>' +
        '<div class="compare-grid">' +
        '  <div class="compare-box astar-box">' +
        '    <div class="title">Algoritmo A* <span class="badge-savings">-' + nodeDiff + '% nós</span></div>' +
        '    <div class="compare-metric"><span>Nós explorados:</span><strong>' + astarNodes + ' nós</strong></div>' +
        '    <div class="compare-metric"><span>Custo do caminho:</span><strong>' + astarCost + 'm</strong></div>' +
        '    <div class="compare-metric"><span>Heurística h(n):</span><strong>Euclidiana</strong></div>' +
        '  </div>' +
        '  <div class="compare-box dijkstra-box">' +
        '    <div class="title">Algoritmo Dijkstra</div>' +
        '    <div class="compare-metric"><span>Nós explorados:</span><strong>' + dijkstraNodes + ' nós</strong></div>' +
        '    <div class="compare-metric"><span>Custo do caminho:</span><strong>' + dijkstraCost + 'm</strong></div>' +
        '    <div class="compare-metric"><span>Heurística h(n):</span><strong>h(n) = 0</strong></div>' +
        '  </div>' +
        '</div>' +
        (lastFireComparison ? '<div class="fire-comparison">' +
        '<div class="compare-metric"><span>Resposta A* ao incêndio:</span><strong>' + lastFireComparison.astar.responseMs + 'ms · ' + lastFireComparison.astar.nodesExplored + ' nós</strong></div>' +
        '<div class="compare-metric"><span>Resposta Dijkstra:</span><strong>' + lastFireComparison.dijkstra.responseMs + 'ms · ' + lastFireComparison.dijkstra.nodesExplored + ' nós</strong></div>' +
        '</div>' : '');
      overlayContainer.appendChild(cardComp);
    }
  }

  function spreadFire() {
    if (activeFires.length === 0) return;
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
  }

  /* ---------- 8. INTERAÇÃO DAS TABS DO MAPA ---------- */
  var chips = mapToolbar.querySelectorAll('.chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeTab = chip.dataset.tab || 'tab-mapa';

      var tabNames = {
        'tab-mapa': 'Visão Geral do Mapa',
        'tab-custo': 'Análise de Custo f(n) = g(n) + h(n)',
        'tab-nos': 'Nós Explorados e Busca',
        'tab-comparar': 'Comparativo A* vs. Dijkstra'
      };
      addLog('Aba selecionada: ' + (tabNames[activeTab] || activeTab));
      renderGraph();
    });
  });

  /* ---------- 9. SIMULAÇÃO E MOVIMENTAÇÃO DE AGENTES ---------- */
  function formatTime(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function updateStatsDisplay() {
    statEvacuados.textContent = evacuados;
    statTotal.textContent = totalAgentes;
    statTempo.textContent = formatTime(elapsedSeconds);
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
    } else if (state === STATE.PAUSED) {
      statusDot.classList.add('paused');
      statusText.textContent = 'Simulação pausada';
    } else {
      statusDot.classList.add('stopped');
      statusText.textContent = 'Simulação parada';
    }
  }

<<<<<<< HEAD
  function tick() {
    elapsedSeconds += 1;
    if (elapsedSeconds % Math.max(2, Math.round(5 / Math.max(0.5, (fireSpreadInput ? parseFloat(fireSpreadInput.value) : 1)))) === 0) {
      spreadFire();
    }
=======
  var agentMarkersMap = new Map();
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50

  function clearAgentMarkers() {
    agentMarkersMap.forEach(function (marker) {
      agentsLayer.removeLayer(marker);
    });
    agentMarkersMap.clear();
  }

  function updateAgentMarkers() {
    if (activeTab !== 'tab-mapa') {
      clearAgentMarkers();
      return;
    }

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
      var stepRate = 0.08 * speed * dt;

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

      if (evacuados >= totalAgentes) {
        addLog('<span class="hl">Todos os ' + totalAgentes + ' agentes foram evacuados com sucesso!</span>');
        stopTimer();
        setStatus(STATE.STOPPED);
      }

      updateStatsDisplay();
    }

    if (activeTab === 'tab-mapa') {
      updateAgentMarkers();
    }

    requestAnimationFrame(animateLoop);
  }

  requestAnimationFrame(animateLoop);

  async function tick() {
    if (state !== STATE.RUNNING) return;
    elapsedSeconds += 1;
    await recalculateAllAgentPathsAsync();
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
    btnIniciar.textContent = 'Simulação rodando';
    btnPausar.textContent = '⏸ Pausar';
  });

  btnPausar.addEventListener('click', function () {
    if (state !== STATE.RUNNING) return;
    stopTimer();
    setStatus(STATE.PAUSED);
    addLog('Simulação pausada');
    btnIniciar.textContent = '▶ Iniciar simulação';
    btnPausar.textContent = 'Simulação pausada';
  });

  btnReiniciar.addEventListener('click', async function () {
    stopTimer();
    evacuados = 0;
    elapsedSeconds = 0;
    nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
    edges = JSON.parse(JSON.stringify(INITIAL_EDGES));
    activeFires = [];
    lastFireComparison = null;
    totalAgentes = 50;

    clearAgentMarkers();
    randomizeExits();
    initAgents();
    await recalculateAllAgentPathsAsync();

    fieldAgentes.textContent = totalAgentes;
    statTotal.textContent = totalAgentes;
    updateStatsDisplay();
    if (statFireAstar) statFireAstar.textContent = '—';
    if (statFireDijkstra) statFireDijkstra.textContent = '—';
    setStatus(STATE.STOPPED);
    resetLog();
    resetChart();

    toolButtons.forEach(function (b) { b.classList.remove('active'); });
    mapCanvas.classList.remove('tool-active');
    activeTool = null;

    btnIniciar.textContent = '▶ Iniciar simulação';
    btnPausar.textContent = '⏸ Pausar';
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
      var closest = null;
      var minDist = Infinity;
      nodes.forEach(function (n) {
        var d = Math.hypot(n.x - x, n.y - y);
        if (d < minDist) { minDist = d; closest = n; }
      });

      if (closest && minDist < 35) {
        igniteFireAtNode(closest, 'manual');
      } else {
        var newId = 'NB' + (nodes.length + 1);
<<<<<<< HEAD
        var newFireNode = { id: newId, name: 'Foco de incêndio (' + x + ',' + y + ')', x: x, y: y, type: 'blocked' };
        nodes.push(newFireNode);
        igniteFireAtNode(newFireNode, 'manual');
      }
=======
        nodes.push({ id: newId, name: 'Bloqueio (' + Math.round(x) + ',' + Math.round(y) + ')', x: x, y: y, type: 'blocked' });
        addLog('<span class="warn">Novo ponto de risco adicionado</span>');
      }
      await recalculateAllAgentPathsAsync();
>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50

    } else if (activeTool === 'saida') {
      var newExitId = 'NE' + (nodes.length + 1);
      nodes.push({ id: newExitId, name: 'Nova Saída (' + Math.round(x) + ',' + Math.round(y) + ')', x: x, y: y, type: 'exit' });

      var nearest = null;
      var minD = Infinity;
      nodes.forEach(function (n) {
        if (n.id !== newExitId) {
          var d = Math.hypot(n.x - x, n.y - y);
          if (d < minD) { minD = d; nearest = n; }
        }
      });
      if (nearest) {
        edges.push({ from: newExitId, to: nearest.id, weight: Math.round(minD), name: 'Acesso Saída' });
      }
      addLog('<span class="hl">Nova saída segura cadastrada</span>');
      await recalculateAllAgentPathsAsync();

    } else if (activeTool === 'pessoa') {
      if (totalAgentes >= MAX_AGENTES) {
        addLog('<span class="warn">Limite máximo de ' + MAX_AGENTES + ' agentes atingido</span>');
        return;
      }
      totalAgentes += 1;
      var snap = snapToNearestStreet(evt.latlng.lat, evt.latlng.lng);
      var newAgent = createAgent(totalAgentes, snap.fromNodeId);
      newAgent.lat = snap.lat;
      newAgent.lng = snap.lng;
      newAgent.x = snap.x;
      newAgent.y = snap.y;
      newAgent.segmentProgress = snap.progress;
      agents.push(newAgent);

      fieldAgentes.textContent = totalAgentes;
      statTotal.textContent = totalAgentes;
      addLog('Novo agente posicionado na rua');
      await recalculateAllAgentPathsAsync();
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

<<<<<<< HEAD
=======
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
          INITIAL_NODES = data.nodes;
          INITIAL_EDGES = data.edges;
          nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
          edges = JSON.parse(JSON.stringify(INITIAL_EDGES));
          addLog('Grafo do bairro carregado via API (/api/graph)');
        }
      }
    } catch (e) {
      console.warn('Usando grafo estático inicial (fallback local)', e);
    }

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

>>>>>>> a449470eab4386d527956d635d65e61dc70f0e50
})();
