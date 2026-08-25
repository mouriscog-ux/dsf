// ============================================================
// SmartEvac — Engine de Simulação & Algoritmos de Busca (A* e Dijkstra)
// Bairro da Liberdade, São Paulo · FECART
// ============================================================

(function () {
  'use strict';

  /* ---------- 1. NAVEGAÇÃO ENTRE ABAS PRINCIPAIS ---------- */
  var navButtons = document.querySelectorAll('.nav-btn');
  var views = document.querySelectorAll('.view');

  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navButtons.forEach(function (b) { b.classList.remove('active'); });
      views.forEach(function (v) { v.classList.remove('active'); });
      btn.classList.add('active');
      var viewEl = document.getElementById(btn.dataset.view);
      if (viewEl) viewEl.classList.add('active');
    });
  });

  /* ---------- 2. ELEMENTOS DA INTERFACE ---------- */
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
  var fieldAgentes  = document.getElementById('field-agentes');

  var logList          = document.getElementById('log-list');
  var mapCanvas        = document.getElementById('map-canvas');
  var pathSvg          = document.getElementById('path-svg');
  var nodesContainer   = document.getElementById('nodes-container');
  var agentsContainer  = document.getElementById('agents-container');
  var tagsContainer    = document.getElementById('tags-container');
  var overlayContainer = document.getElementById('overlay-container');
  var mapLegend        = document.getElementById('map-legend');
  var mapToolbar       = document.getElementById('map-toolbar');

  var evacLine    = document.getElementById('evac-line');
  var evacArea    = document.getElementById('evac-area');
  var chartXStart = document.getElementById('chart-x-start');
  var chartXMid   = document.getElementById('chart-x-mid');
  var chartXEnd   = document.getElementById('chart-x-end');

  var toolButtons = document.querySelectorAll('.tool-btn');

  var DEFAULT_LOG = [
    'Simulação iniciada — 50 agentes',
    '<span class="warn">Bloqueio em R. Galvão Bueno (Viaduto Osaka)</span>',
    'Agentes calculando rota via A*',
    '<span class="hl">Agente #03 chegou à saída Metrô Liberdade</span>'
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

  /* ---------- 3. BANCO DE DADOS DO GRAFO (Bairro da Liberdade) ---------- */
  var INITIAL_NODES = [
    { id: 'N1', name: 'R. Galvão Bueno (Norte)', x: 60, y: 90, type: 'normal' },
    { id: 'N2', name: 'Cruzamento Galvão x Estudantes', x: 210, y: 95, type: 'normal' },
    { id: 'N3', name: 'Saída Metrô Liberdade', x: 340, y: 70, type: 'exit' },
    { id: 'N4', name: 'Viaduto Cidade de Osaka', x: 140, y: 60, type: 'blocked' },
    { id: 'N5', name: 'R. dos Estudantes (Oeste)', x: 90, y: 260, type: 'normal' },
    { id: 'N6', name: 'Cruzamento Estudantes x Américo', x: 200, y: 200, type: 'normal' },
    { id: 'N7', name: 'Saída Praça da Liberdade', x: 300, y: 180, type: 'exit' },
    { id: 'N8', name: 'Rua da Glória (Sul)', x: 160, y: 230, type: 'normal' },
    { id: 'N9', name: 'Rua Américo de Campos', x: 270, y: 270, type: 'normal' },
    { id: 'N10', name: 'Saída Av. Liberdade', x: 420, y: 130, type: 'exit' },
    { id: 'N11', name: 'Rua Conselheiro Furtado', x: 380, y: 230, type: 'normal' },
    { id: 'N12', name: 'Rua São Joaquim', x: 110, y: 340, type: 'normal' }
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

  var nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
  var edges = JSON.parse(JSON.stringify(INITIAL_EDGES));

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
        if (target && target.type !== 'blocked') list.push({ node: target, weight: e.weight, edge: e });
      } else if (e.to === nodeId) {
        var target = getNode(e.from);
        if (target && target.type !== 'blocked') list.push({ node: target, weight: e.weight, edge: e });
      }
    });
    return list;
  }

  function distance(nodeA, nodeB) {
    var dx = nodeA.x - nodeB.x;
    var dy = nodeA.y - nodeB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------- 4. ALGORITMOS DE BUSCA (A* e Dijkstra) ---------- */
  function findPath(startId, useHeuristic) {
    var startNode = getNode(startId);
    if (!startNode || startNode.type === 'blocked') return null;

    // Encontra saídas ativas
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

    var destinationExit = null;

    while (openSet.length > 0) {
      // Pega nó com menor fScore
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
        destinationExit = currNode;
        // Reconstrói caminho
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
          destinationExit: destinationExit,
          gScore: gScore,
          fScore: fScore
        };
      }

      var neighbors = getNeighbors(currentId);
      neighbors.forEach(function (nb) {
        var neighborId = nb.node.id;
        if (closedSet.indexOf(neighborId) !== -1) return;

        var tentativeG = gScore[currentId] + nb.weight;
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

  /* ---------- 5. ESTADO DA SIMULAÇÃO E AGENTES ---------- */
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

  function createAgent(id, startNodeId) {
    var normalNodes = nodes.filter(function (n) { return n.type === 'normal'; });
    if (!startNodeId) {
      var randNode = normalNodes[Math.floor(Math.random() * normalNodes.length)];
      startNodeId = randNode ? randNode.id : 'N1';
    }
    var res = findPath(startNodeId, true);
    return {
      id: id,
      currentNodeId: startNodeId,
      path: res ? res.path : [startNodeId],
      pathIndex: 0,
      segmentProgress: 0, // 0 a 1 no segmento atual
      x: getNode(startNodeId) ? getNode(startNodeId).x : 60,
      y: getNode(startNodeId) ? getNode(startNodeId).y : 90,
      evacuated: false
    };
  }

  function initAgents() {
    agents = [];
    for (var i = 1; i <= totalAgentes; i++) {
      agents.push(createAgent(i));
    }
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
  }

  /* ---------- 6. RENDERIZAÇÃO DO GRAFO E TABS ---------- */
  function renderGraph() {
    // 1. Desenha arestas SVG
    var svgContent = '';
    edges.forEach(function (e) {
      var n1 = getNode(e.from);
      var n2 = getNode(e.to);
      if (!n1 || !n2) return;
      var isBlockedEdge = n1.type === 'blocked' || n2.type === 'blocked';
      var strokeColor = isBlockedEdge ? 'var(--danger)' : '#2d374d';
      var dashArray = isBlockedEdge ? '4 4' : 'none';

      svgContent += '<line x1="' + n1.x + '" y1="' + n1.y + '" x2="' + n2.x + '" y2="' + n2.y + '" ' +
        'stroke="' + strokeColor + '" stroke-width="3" stroke-dasharray="' + dashArray + '" opacity="0.8"/>';
    });

    // Se estiver na aba mapa, desenha rotas do A* dos agentes
    if (activeTab === 'tab-mapa') {
      var samplePaths = [];
      agents.forEach(function (ag) {
        if (!ag.evacuated && ag.path && ag.path.length > 1 && samplePaths.length < 3) {
          samplePaths.push(ag.path);
        }
      });
      samplePaths.forEach(function (pth) {
        var dStr = '';
        for (var i = 0; i < pth.length; i++) {
          var n = getNode(pth[i]);
          if (n) dStr += (i === 0 ? 'M ' : ' L ') + n.x + ' ' + n.y;
        }
        svgContent += '<path d="' + dStr + '" stroke="var(--safe)" stroke-width="2.5" fill="none" stroke-dasharray="6 5" opacity="0.85"/>';
      });
    }

    pathSvg.innerHTML = svgContent;

    // 2. Desenha Nós
    nodesContainer.innerHTML = '';
    nodes.forEach(function (n) {
      var el = document.createElement('div');
      el.className = 'node ' + (n.type !== 'normal' ? n.type : '');
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.title = n.name;

      if (activeTab === 'tab-nos') {
        var sampleRes = findPath('N1', true);
        if (sampleRes) {
          if (sampleRes.openSet.indexOf(n.id) !== -1) el.classList.add('open-set');
          else if (sampleRes.closedSet.indexOf(n.id) !== -1) el.classList.add('closed-set');
        }
      } else if (activeTab === 'tab-comparar') {
        var astarRes = findPath('N1', true);
        var dijkRes = findPath('N1', false);
        if (astarRes && astarRes.closedSet.indexOf(n.id) !== -1) el.classList.add('closed-set');
        else if (dijkRes && dijkRes.closedSet.indexOf(n.id) !== -1) el.classList.add('dijkstra-visited');
      }

      nodesContainer.appendChild(el);
    });

    // 3. Desenha Nomes de Ruas principais
    tagsContainer.innerHTML = '';
    var mainTags = [
      { text: 'R. Galvão Bueno', top: 78, left: 66 },
      { text: 'R. dos Estudantes', top: 242, left: 96 },
      { text: 'Av. Liberdade', top: 110, left: 340 }
    ];
    mainTags.forEach(function (tg) {
      var tagEl = document.createElement('div');
      tagEl.className = 'map-tag';
      tagEl.style.top = tg.top + 'px';
      tagEl.style.left = tg.left + 'px';
      tagEl.textContent = tg.text;
      tagsContainer.appendChild(tagEl);
    });

    // 4. Desenha Agentes
    agentsContainer.innerHTML = '';
    if (activeTab === 'tab-mapa') {
      agents.forEach(function (ag) {
        if (ag.evacuated) return;
        var agEl = document.createElement('div');
        agEl.className = 'agent';
        agEl.style.left = ag.x + 'px';
        agEl.style.top = ag.y + 'px';
        agentsContainer.appendChild(agEl);
      });
    }

    // 5. Renderiza a aba ativa no overlay
    renderActiveTabOverlay();
  }

  function renderActiveTabOverlay() {
    overlayContainer.innerHTML = '';

    if (activeTab === 'tab-custo') {
      // Mostra f(n) = g(n) + h(n) para cada nó a partir de N1
      var res = findPath('N1', true);
      if (res) {
        nodes.forEach(function (n) {
          if (n.type === 'blocked') return;
          var g = res.gScore[n.id];
          var f = res.fScore[n.id];
          var h = f !== Infinity && g !== Infinity ? (f - g) : 0;
          if (g === Infinity) return;

          var tag = document.createElement('div');
          tag.className = 'cost-tag';
          tag.style.left = n.x + 'px';
          tag.style.top = n.y + 'px';
          tag.innerHTML = 'f:' + Math.round(f) + ' (g:' + Math.round(g) + '+h:' + Math.round(h) + ')';
          tag.title = n.name + '\nCusto g(n): ' + Math.round(g) + ' | Heurística h(n): ' + Math.round(h);
          overlayContainer.appendChild(tag);
        });
      }

      var card = document.createElement('div');
      card.className = 'overlay-card';
      card.innerHTML = '<div style="font-weight:700; color:var(--safe); margin-bottom:4px;">Custo Heurístico f(n) = g(n) + h(n)</div>' +
        '<div style="font-size:12px; color:var(--text-muted);">' +
        'Cada nó exibe o custo percorrido <strong>g(n)</strong> somado à estimativa Euclidiana <strong>h(n)</strong> até a saída. O A* sempre prioriza o menor <strong>f(n)</strong>.' +
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
        '<span style="font-weight:700; color:var(--amber);">Espaço de Busca — Nós Explorados</span>' +
        '<span class="badge-savings">' + savingsPct + '% de nós poupados</span>' +
        '</div>' +
        '<div style="font-size:12px; color:var(--text-muted); line-height:1.5;">' +
        '• <span style="color:var(--amber); font-weight:600;">Amarelo pulsante</span>: Fila de Prioridade (Open Set)<br>' +
        '• <span style="color:#c084fc; font-weight:600;">Roxo</span>: Nós já avaliados e fechados (Closed Set: ' + nodesExploredCount + '/' + totalGraphNodes + ' nós)' +
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
      cardComp.innerHTML = '<div style="font-weight:700; color:var(--text); margin-bottom:6px; font-family:\'Space Grotesk\', sans-serif;">' +
        'Comparativo de Desempenho: A* vs. Dijkstra' +
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
        '</div>';
      overlayContainer.appendChild(cardComp);
    }
  }

  /* ---------- 7. TROCA DE TABS DO PAINEL CENTRAL (CHIPS) ---------- */
  var chips = mapToolbar.querySelectorAll('.chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeTab = chip.dataset.tab || 'tab-mapa';

      var tabNames = {
        'tab-mapa': 'Visualização Geral do Mapa',
        'tab-custo': 'Análise de Custo f(n) = g(n) + h(n)',
        'tab-nos': 'Nós Explorados e Espaço de Busca',
        'tab-comparar': 'Comparativo A* vs. Dijkstra'
      };
      addLog('Aba selecionada: ' + (tabNames[activeTab] || activeTab));
      renderGraph();
    });
  });

  /* ---------- 8. LÓGICA DE SIMULAÇÃO E MOVIMENTAÇÃO DE AGENTES ---------- */
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

  function rndAgentId() {
    return String(Math.floor(Math.random() * totalAgentes) + 1).padStart(2, '0');
  }

  function tick() {
    elapsedSeconds += 1;

    // Atualiza movimento real dos agentes ao longo de suas rotas A*
    var stepDelta = 0.25 * speed;
    agents.forEach(function (ag) {
      if (ag.evacuated) return;

      if (!ag.path || ag.path.length <= 1 || ag.pathIndex >= ag.path.length - 1) {
        var nEvac = getNode(ag.currentNodeId);
        if (nEvac && nEvac.type === 'exit') {
          ag.evacuated = true;
          evacuados++;
          addLog('<span class="hl">Agente #' + String(ag.id).padStart(2, '0') + ' evacuou via ' + nEvac.name + '</span>');
        } else {
          // Tenta recalcular caminho
          var newRes = findPath(ag.currentNodeId, true);
          if (newRes) {
            ag.path = newRes.path;
            ag.pathIndex = 0;
            ag.segmentProgress = 0;
          }
        }
        return;
      }

      ag.segmentProgress += stepDelta;
      if (ag.segmentProgress >= 1) {
        ag.segmentProgress = 0;
        ag.pathIndex++;
        ag.currentNodeId = ag.path[ag.pathIndex];

        var currNode = getNode(ag.currentNodeId);
        if (currNode && currNode.type === 'exit') {
          ag.evacuated = true;
          evacuados++;
          addLog('<span class="hl">Agente #' + String(ag.id).padStart(2, '0') + ' evacuou via ' + currNode.name + '</span>');
        }
      }

      // Interpola coordenadas (x,y)
      if (!ag.evacuated && ag.path && ag.pathIndex < ag.path.length - 1) {
        var nFrom = getNode(ag.path[ag.pathIndex]);
        var nTo   = getNode(ag.path[ag.pathIndex + 1]);
        if (nFrom && nTo) {
          ag.x = nFrom.x + (nTo.x - nFrom.x) * ag.segmentProgress;
          ag.y = nFrom.y + (nTo.y - nFrom.y) * ag.segmentProgress;
        }
      }
    });

    recalculateAllAgentPaths();

    if (evacuados >= totalAgentes) {
      addLog('<span class="hl">Todos os ' + totalAgentes + ' agentes foram evacuados com sucesso!</span>');
      stopTimer();
      setStatus(STATE.STOPPED);
    }

    updateStatsDisplay();
    pushChartPoint();
    renderGraph();
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

  /* ---------- 9. BOTÕES DE CONTROLE ---------- */
  function flashButton(btn, className) {
    btn.classList.remove(className);
    void btn.offsetWidth;
    btn.classList.add(className);
  }

  btnIniciar.addEventListener('click', function () {
    if (state === STATE.RUNNING) return;
    if (state === STATE.STOPPED) addLog('Simulação iniciada — ' + totalAgentes + ' agentes');
    else addLog('Simulação retomada');

    setStatus(STATE.RUNNING);
    startTimer();
    btnIniciar.textContent = 'Simulação rodando';
    btnPausar.textContent = '⏸ Pausar';
    flashButton(btnIniciar, 'flash-white');
  });

  btnPausar.addEventListener('click', function () {
    if (state !== STATE.RUNNING) return;
    stopTimer();
    setStatus(STATE.PAUSED);
    addLog('Simulação pausada');
    btnIniciar.textContent = '▶ Iniciar simulação';
    btnPausar.textContent = 'Simulação pausada';
    flashButton(btnPausar, 'flash-primary');
  });

  btnReiniciar.addEventListener('click', function () {
    stopTimer();
    evacuados = 0;
    elapsedSeconds = 0;
    nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
    edges = JSON.parse(JSON.stringify(INITIAL_EDGES));
    totalAgentes = 50;

    initAgents();
    recalculateAllAgentPaths();

    fieldAgentes.textContent = totalAgentes;
    statTotal.textContent = totalAgentes;
    updateStatsDisplay();
    setStatus(STATE.STOPPED);
    resetLog();
    resetChart();

    toolButtons.forEach(function (b) { b.classList.remove('active'); });
    mapCanvas.classList.remove('tool-active');
    activeTool = null;

    btnIniciar.textContent = '▶ Iniciar simulação';
    btnPausar.textContent = '⏸ Pausar';
    flashButton(btnReiniciar, 'flash-primary');
    renderGraph();
  });

  /* ---------- 10. FERRAMENTAS DO MAPA (Bloqueio, Saída, Pessoa) ---------- */
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

  mapCanvas.addEventListener('click', function (evt) {
    if (!activeTool) return;

    var rect = mapCanvas.getBoundingClientRect();
    var x = Math.round(evt.clientX - rect.left);
    var y = Math.round(evt.clientY - rect.top);

    if (activeTool === 'bloqueio') {
      // Encontra nó mais próximo ou cria nó bloqueado
      var closest = null;
      var minDist = Infinity;
      nodes.forEach(function (n) {
        var d = Math.hypot(n.x - x, n.y - y);
        if (d < minDist) { minDist = d; closest = n; }
      });

      if (closest && minDist < 35) {
        closest.type = 'blocked';
        addLog('<span class="warn">Nó ' + closest.name + ' foi bloqueado (incêndio/risco)</span>');
      } else {
        var newId = 'NB' + (nodes.length + 1);
        var newNode = { id: newId, name: 'Bloqueio (' + x + ',' + y + ')', x: x, y: y, type: 'blocked' };
        nodes.push(newNode);
        addLog('<span class="warn">Novo ponto de risco bloqueado adicionado ao mapa</span>');
      }
      recalculateAllAgentPaths();

    } else if (activeTool === 'saida') {
      var newExitId = 'NE' + (nodes.length + 1);
      var newExit = { id: newExitId, name: 'Nova Saída (' + x + ',' + y + ')', x: x, y: y, type: 'exit' };
      nodes.push(newExit);

      // Conecta com o nó mais próximo
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
      addLog('<span class="hl">Nova saída segura cadastrada no mapa</span>');
      recalculateAllAgentPaths();

    } else if (activeTool === 'pessoa') {
      if (totalAgentes >= MAX_AGENTES) {
        addLog('<span class="warn">Limite máximo de ' + MAX_AGENTES + ' agentes atingido</span>');
        return;
      }
      totalAgentes += 1;
      var newAgent = createAgent(totalAgentes);
      newAgent.x = x;
      newAgent.y = y;
      agents.push(newAgent);

      fieldAgentes.textContent = totalAgentes;
      statTotal.textContent = totalAgentes;
      addLog('Novo agente #' + String(totalAgentes).padStart(2, '0') + ' adicionado ao mapa');
      recalculateAllAgentPaths();
    }

    renderGraph();
  });

  /* ---------- 11. SLIDER DE VELOCIDADE ---------- */
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

  /* ---------- 12. INICIALIZAÇÃO ---------- */
  applySpeed(1.5);
  initAgents();
  recalculateAllAgentPaths();
  setStatus(STATE.STOPPED);
  updateStatsDisplay();
  pushChartPoint();
  renderGraph();

})();