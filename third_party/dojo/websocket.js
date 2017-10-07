var EditorSocket = function(editorLayer, source) {

  this._socket = null;
  this._editorLayer = editorLayer;

  try {

    // Make a path for a specitfic channel
    var host = "ws://"+source.baseUrls[0];
    var hostPath = `${host}/ws/${key}/${channel}`;

    // Create the websocket connection
    this._socket = new WebSocket(hostPath);

    this._socket.onopen = this.on_open.bind(this);
    this._socket.onclose = this.on_close.bind(this);
    this._socket.onmessage = this.on_message.bind(this);

  } catch (e) {
    console.log('Websocket connection failed.');
  }

};

EditorSocket.prototype.on_open = function() {

  console.log('Established websocket connection.');

};

EditorSocket.prototype.on_message = function(m) {

  this._editorLayer.handleMessage(m);

};

EditorSocket.prototype.send = function(m) {

  this._socket.send(m);

};

EditorSocket.prototype.on_close = function() {

  console.log('Websocket connection dropped.');

};

/*
 * Export as module to convert to typescript
 */
if (typeof exports !== "undefined") {
  module.exports = {
    EditorSocket: EditorSocket,
  };
}
