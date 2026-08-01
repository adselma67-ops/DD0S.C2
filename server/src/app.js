const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 5000);
const API_TOKEN = process.env.API_TOKEN || 'nexus-demo-token';

app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.locals.apiToken = API_TOKEN;

app.use('/api', routes);
app.use(express.static(path.join(__dirname, '../../client')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      // Ignore malformed frames.
    }
  });
  ws.on('close', () => clients.delete(ws));
});

app.locals.clients = clients;

function broadcast(payload) {
  const message = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

app.locals.broadcast = broadcast;

server.listen(PORT, () => {
  console.log(`C2 monitoring server running on http://localhost:${PORT}`);
});

module.exports = { app, server, broadcast };
