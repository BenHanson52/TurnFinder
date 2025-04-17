// wsBroadcast.js
function broadcastPinCreate(wss, newPinData) {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'newPin', data: newPinData }));
      }
      else {
        console.log("error, clients undefined");
      }
    });
  }
  
  function broadcastPinEdit(wss, editPinData) {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'editPin', data: editPinData }));
      }
      else {
        console.log("error, clients undefined");
      }
    });
  }
  
  function broadcastPinDelete(wss, deletePinData) {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ action: 'deletePin', data: deletePinData }));
      }
      else {
        console.log("error, clients undefined");
      }
    });
  }
  
  module.exports = { broadcastPinCreate, broadcastPinEdit, broadcastPinDelete };
  