// mapproj_server.js
const { server } = require('./mapproj_API');
const WebSocket = require('ws');
const port = 3000;

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
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} with HTTP and WebSocket support.`);
});
