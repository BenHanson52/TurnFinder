// mapproj_server.js
require('dotenv').config({ path: '/var/www/mapproj/.env' });
const fs        = require('fs');
const http      = require('http');
const https     = require('https');
const { requestHandler } = require('./mapproj_API');
const WebSocket = require('ws');

const isDev = process.env.NODE_ENV === 'development';
const PORT  = process.env.PORT || 3001;
console.log("Listening on ", process.env.PORT) //added for debugging purposes

let server;
if (isDev) {
  server = http.createServer(requestHandler);
} else {
  const options = {
    key:  fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  };
  server = https.createServer(options, requestHandler);
}

// Create the WebSocket server
const wss = new WebSocket.Server({ server });

// Store the WebSocket server instance globally
global.wss = wss;

// **NEW: Define global broadcast functions inline without importing from wsBroadcast.js**
global.broadcast = {
  broadcastPinCreate: function(newPinData) {
    if (!global.wss) {
      console.error("global.wss is not defined in broadcastPinCreate");
      return;
    }
    global.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'newPin', data: newPinData }));
      }
    });
  },
  broadcastPinEdit: function(editPinData) {
    if (!global.wss) {
      console.error("global.wss is not defined in broadcastPinEdit");
      return;
    }
    global.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'editPin', data: editPinData }));
      }
    });
  },
  broadcastPinDelete: function(deletePinData) {
    if (!global.wss) {
      console.error("global.wss is not defined in broadcastPinDelete");
      return;
    }
    global.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'deletePin', data: deletePinData }));
      }
    });
  }
};

wss.on('connection', (ws) => {
  console.log('A new WebSocket client connected.');
  ws.send(JSON.stringify({ message: "Welcome to the Summertime Skiing CO WS" }));
  
  ws.on('message', (msg) => {
    console.log('Received message via WebSocket:', msg);
  });

  ws.on('close', () => {
    console.log('A WebSocket client disconnected.');
  });
});

// Start the HTTP server (which now handles both API and WS)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`${isDev ? 'HTTP' : 'HTTPS'} server listening on port ${PORT}`);
});
