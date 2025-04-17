const express = require('express');
const WebSocket = require('ws');
const app = express();
const PORT = 4000;

// Enhanced WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
const clients = new Set();

// HTTP Server
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[SERVER] WebSocket ready on ws://localhost:${PORT}`);
});

// WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  console.log('[WS] Upgrade request received');
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('[WS] New client connected');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
});

// Enhanced GSI endpoint with validation
app.post('/gsi', express.json(), (req, res) => {
  if (!req.body) {
    console.warn('[GSI] Empty request received');
    return res.status(400).send('Bad Request');
  }

  //console.log('[GSI] Received data with keys:', Object.keys(req.body));
  
  // Broadcast to all WebSocket clients
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        receivedAt: new Date().toISOString(),
        hero: req.body.hero || null,
        player: req.body.player || null,
        map: req.body.map || null
      }));
    }
  });

  res.status(200).send('OK');
});

// Serve static files
app.use(express.static('public'));

// Add root route for testing
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

console.log('[SERVER] Waiting for Dota 2 GSI data...');