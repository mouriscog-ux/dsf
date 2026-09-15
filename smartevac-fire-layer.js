(function () {
  "use strict";

  const state = {
    enabled: false,
    intensity: 55,
    spreadRate: 18,
    fires: [],
    lastStats: null,
    sequence: 0
  };

  const selectors = {
    map: "#map, .map, #evacuation-map, .evacuation-map, [data-map]",
    menu: "nav, header, .navbar, .nav, .menu, .topbar, [data-menu]",
    panel: "#control-panel, .control-panel, #sidebar, .sidebar, aside",
    stats: "#stats, .stats, #statistics-panel, .statistics-panel, [data-stats]",
    log: "#event-log, .event-log, #log, .log, [data-event-log]",
    fireTool: "[data-tool='fire'], [data-tool='block'], .tool-fire, .tool-block, #fireTool, #blockTool"
  };

  const themeStorageKey = "smartEvacTheme";

  function boot() {
    initTheme();

    const map = document.querySelector(selectors.map);
    if (!map) return;

    map.style.position = map.style.position || "relative";
    injectPanel();
    bindExistingFireTool();
    map.addEventListener("click", handleMapClick);
    window.SmartEvacFireSimulation = api;
    log("> CAMADA DE SIMULACAO DE INCENDIO DINAMICO ATIVA");
  }

  function initTheme() {
    const savedTheme = readSavedTheme();
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");

    setTheme(theme, false);
    injectThemeToggle();
    window.setTimeout(() => document.documentElement.classList.add("theme-ready"), 0);
  }

  function injectThemeToggle() {
    if (document.getElementById("theme-toggle")) return;

    const host = document.querySelector(selectors.menu) || document.querySelector(selectors.panel);
    if (!host) return;

    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    const isFallback = !host.matches(selectors.menu);

    wrapper.className = "theme-toggle-host" + (isFallback ? " theme-toggle-fallback" : "");
    button.id = "theme-toggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTheme(current === "dark" ? "light" : "dark", true);
    });

    wrapper.appendChild(button);
    if (isFallback) {
      host.insertBefore(wrapper, host.firstChild);
    } else {
      host.appendChild(wrapper);
    }

    updateThemeToggle();
  }

  function setTheme(theme, persist) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    if (persist) saveTheme(nextTheme);
    updateThemeToggle();
  }

  function updateThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    const isDark = document.documentElement.dataset.theme === "dark";
    button.setAttribute("aria-label", isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro");
    button.setAttribute("title", isDark ? "Modo Claro" : "Modo Escuro");
    button.setAttribute("aria-pressed", String(isDark));
    button.innerHTML = [
      "<span class='theme-toggle-icon' aria-hidden='true'>" + (isDark ? "☀️" : "🌙") + "</span>",
      "<span class='theme-toggle-label'>" + (isDark ? "Modo Claro" : "Modo Escuro") + "</span>"
    ].join("");
  }

  function readSavedTheme() {
    try {
      return localStorage.getItem(themeStorageKey);
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      // Browsers can block storage in private or restricted contexts.
    }
  }

  function injectPanel() {
    const host = document.querySelector(selectors.panel);
    if (!host || document.getElementById("fire-sim-panel")) return;

    const panel = document.createElement("section");
    panel.id = "fire-sim-panel";
    panel.className = "fire-sim-panel";
    panel.innerHTML = [
      "<h3>Simulacao de Incendio</h3>",
      "<button id='fire-sim-toggle' type='button'>Ferramenta de Fogo</button>",
      "<div class='fire-sim-control'>",
      "  <label for='fire-intensity'>Intensidade do Fogo <span id='fire-intensity-value'>55</span></label>",
      "  <input id='fire-intensity' type='range' min='10' max='100' value='55'>",
      "</div>",
      "<div class='fire-sim-control'>",
      "  <label for='fire-spread'>Taxa de Espalhamento <span id='fire-spread-value'>18</span></label>",
      "  <input id='fire-spread' type='range' min='0' max='100' value='18'>",
      "</div>",
      "<div id='fire-live-stats' class='fire-stats' aria-live='polite'></div>"
    ].join("");

    host.appendChild(panel);
    document.getElementById("fire-sim-toggle").addEventListener("click", toggleFireTool);
    bindRange("fire-intensity", "intensity");
    bindRange("fire-spread", "spreadRate");
  }

  function bindExistingFireTool() {
    document.querySelectorAll(selectors.fireTool).forEach((button) => {
      button.addEventListener("click", () => setFireTool(true));
    });
  }

  function bindRange(id, key) {
    const input = document.getElementById(id);
    const value = document.getElementById(id + "-value");
    if (!input || !value) return;

    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      value.textContent = input.value;
      recomputeAllRoutes("parametros do incendio atualizados");
    });
  }

  function toggleFireTool() {
    setFireTool(!state.enabled);
  }

  function setFireTool(enabled) {
    state.enabled = enabled;
    document.getElementById("fire-sim-toggle")?.classList.toggle("fire-tool-active", enabled);
    document.querySelectorAll(selectors.fireTool).forEach((button) => {
      button.classList.toggle("fire-tool-active", enabled);
    });
  }

  function handleMapClick(event) {
    if (!state.enabled) return;
    const map = event.currentTarget;
    const rect = map.getBoundingClientRect();
    const point = {
      id: "fire-" + ++state.sequence,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      intensity: state.intensity,
      spreadRate: state.spreadRate,
      createdAt: performance.now()
    };

    addFire(point, map);
  }

  function addFire(point, map) {
    const nearest = findNearestRoadOrNode(point);
    point.target = nearest;
    state.fires.push(point);
    drawFire(point, map || document.querySelector(selectors.map));
    log("> INCENDIO DETECTADO NA " + describeTarget(nearest));
    recomputeAllRoutes("novo foco de incendio");

    if (point.spreadRate > 0) {
      window.setTimeout(() => spreadFire(point), Math.max(1400, 7000 - point.spreadRate * 45));
    }
  }

  function drawFire(point, map) {
    if (!map) return;
    const heat = document.createElement("div");
    const core = document.createElement("div");
    const radius = heatRadius(point);

    heat.className = "fire-heat-zone";
    heat.style.left = point.x + "px";
    heat.style.top = point.y + "px";
    heat.style.width = radius * 2 + "px";
    heat.style.height = radius * 2 + "px";
    heat.dataset.fireId = point.id;

    core.className = "fire-node";
    core.style.left = point.x + "px";
    core.style.top = point.y + "px";
    core.dataset.fireId = point.id;

    map.appendChild(heat);
    map.appendChild(core);
  }

  function spreadFire(source) {
    const map = document.querySelector(selectors.map);
    if (!map || !state.fires.includes(source)) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = 48 + source.spreadRate * 0.85;
    const point = {
      id: "fire-" + ++state.sequence,
      x: clamp(source.x + Math.cos(angle) * distance, 12, map.clientWidth - 12),
      y: clamp(source.y + Math.sin(angle) * distance, 12, map.clientHeight - 12),
      intensity: Math.max(10, source.intensity * 0.88),
      spreadRate: Math.max(0, source.spreadRate * 0.82),
      createdAt: performance.now()
    };

    addFire(point, map);
  }

  function recomputeAllRoutes(reason) {
    const graph = getGraph();
    const agents = getAgents();
    if (!graph || !agents.length) {
      updateStats(null, null);
      log("> AGENTES RECALCULANDO ROTA VIA A*");
      return;
    }

    let totalAStar = { time: 0, explored: 0 };
    let totalDijkstra = { time: 0, explored: 0 };

    agents.forEach((agent) => {
      const start = agent.currentNode || agent.node || agent.positionNode || agent.start;
      const goal = agent.destinationNode || agent.goal || agent.exit || agent.target;
      if (!start || !goal) return;

      const astar = runSearch(graph, start, goal, true);
      const dijkstra = runSearch(graph, start, goal, false);
      totalAStar.time += astar.time;
      totalAStar.explored += astar.explored;
      totalDijkstra.time += dijkstra.time;
      totalDijkstra.explored += dijkstra.explored;

      if (astar.path.length) {
        agent.route = astar.path;
        agent.path = astar.path;
        if (typeof agent.setRoute === "function") agent.setRoute(astar.path, { reason });
      }
    });

    updateStats(totalAStar, totalDijkstra);
    log("> AGENTES RECALCULANDO ROTA VIA A*");

    if (typeof window.renderAgents === "function") window.renderAgents();
    if (typeof window.updateSimulation === "function") window.updateSimulation();
  }

  function runSearch(graph, start, goal, useHeuristic) {
    const started = performance.now();
    const open = [{ id: start, f: 0 }];
    const cameFrom = new Map();
    const g = new Map([[start, 0]]);
    const visited = new Set();
    let explored = 0;

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift().id;
      if (visited.has(current)) continue;
      visited.add(current);
      explored++;
      if (current === goal) break;

      neighbors(graph, current).forEach((edge) => {
        const hazard = fireCost(edge, graph);
        if (hazard === Infinity) return;
        const tentative = (g.get(current) || 0) + edge.weight + hazard;
        if (tentative < (g.get(edge.to) ?? Infinity)) {
          cameFrom.set(edge.to, current);
          g.set(edge.to, tentative);
          open.push({
            id: edge.to,
            f: tentative + (useHeuristic ? heuristic(graph, edge.to, goal) : 0)
          });
        }
      });
    }

    return {
      explored,
      path: reconstructPath(cameFrom, start, goal),
      time: performance.now() - started
    };
  }

  function fireCost(edge, graph) {
    const a = graph.nodes?.[edge.from] || edge.fromNode;
    const b = graph.nodes?.[edge.to] || edge.toNode;
    const mid = {
      x: ((a?.x || 0) + (b?.x || 0)) / 2,
      y: ((a?.y || 0) + (b?.y || 0)) / 2
    };

    return state.fires.reduce((cost, fire) => {
      const distance = Math.hypot(mid.x - fire.x, mid.y - fire.y);
      const radius = heatRadius(fire);
      if (distance < 12 && fire.intensity > 78) return Infinity;
      if (distance > radius) return cost;
      return cost + (1 - distance / radius) * fire.intensity * 9;
    }, 0);
  }

  function heatRadius(fire) {
    return 34 + fire.intensity * 0.9;
  }

  function neighbors(graph, id) {
    if (Array.isArray(graph.edges)) {
      return graph.edges
        .filter((edge) => edge.from === id || edge.source === id)
        .map((edge) => ({
          from: edge.from || edge.source,
          to: edge.to || edge.target,
          weight: Number(edge.weight || edge.cost || edge.distance || 1),
          fromNode: edge.fromNode,
          toNode: edge.toNode
        }));
    }

    return (graph[id] || []).map((edge) => ({
      from: id,
      to: edge.to || edge.id || edge.node,
      weight: Number(edge.weight || edge.cost || edge.distance || 1)
    }));
  }

  function heuristic(graph, from, to) {
    const a = graph.nodes?.[from];
    const b = graph.nodes?.[to];
    if (!a || !b) return 0;
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  function reconstructPath(cameFrom, start, goal) {
    if (!cameFrom.has(goal) && start !== goal) return [];
    const path = [goal];
    let current = goal;
    while (current !== start) {
      current = cameFrom.get(current);
      if (!current) return [];
      path.unshift(current);
    }
    return path;
  }

  function updateStats(astar, dijkstra) {
    state.lastStats = { astar, dijkstra };
    const host = document.getElementById("fire-live-stats") || document.querySelector(selectors.stats);
    if (!host) return;

    const aNodes = astar?.explored || 0;
    const dNodes = dijkstra?.explored || 0;
    const aTime = astar ? astar.time.toFixed(2) : "0.00";
    const dTime = dijkstra ? dijkstra.time.toFixed(2) : "0.00";
    const maxNodes = Math.max(aNodes, dNodes, 1);

    host.innerHTML = [
      statRow("A*", aNodes, maxNodes, aTime + "ms", ""),
      statRow("Dijkstra", dNodes, maxNodes, dTime + "ms", "dijkstra")
    ].join("");
  }

  function statRow(label, explored, max, time, className) {
    const width = Math.max(4, Math.round((explored / max) * 100));
    return [
      "<div class='fire-stat-row'>",
      "  <span class='fire-stat-label'>" + label + "</span>",
      "  <span class='fire-stat-bar'><span class='fire-stat-fill " + className + "' style='width:" + width + "%'></span></span>",
      "  <span class='fire-stat-value'>" + explored + " nos<br>" + time + "</span>",
      "</div>"
    ].join("");
  }

  function findNearestRoadOrNode(point) {
    const graph = getGraph();
    if (!graph?.nodes) return { name: "RUA GALVAO BUENO", point };

    let best = null;
    Object.entries(graph.nodes).forEach(([id, node]) => {
      const distance = Math.hypot((node.x || 0) - point.x, (node.y || 0) - point.y);
      if (!best || distance < best.distance) {
        best = { id, name: node.street || node.name || id, distance };
      }
    });
    return best || { name: "RUA GALVAO BUENO", point };
  }

  function describeTarget(target) {
    return String(target?.name || target?.id || "RUA GALVAO BUENO").toUpperCase();
  }

  function getGraph() {
    return window.smartEvacGraph || window.evacuationGraph || window.cityGraph || window.graph || null;
  }

  function getAgents() {
    const agents = window.smartEvacAgents || window.evacuationAgents || window.agents || [];
    return Array.isArray(agents) ? agents : [];
  }

  function log(message) {
    const host = document.querySelector(selectors.log);
    if (!host) return;
    const item = document.createElement("div");
    item.textContent = message;
    host.prepend(item);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const api = {
    addFireAt: addFire,
    getFires: () => state.fires.slice(),
    getLastStats: () => state.lastStats,
    recomputeRoutes: recomputeAllRoutes,
    setFireTool
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
