var EditorSocket = function(editorLayer) {

  this._socket = undefined;
  this._editorLayer = editorLayer;
};

EditorSocket.prototype.open = function(resolve, reject) {

  // Try to connect
  var hostPath = this._formatPath();
  try {
    this._socket = new WebSocket(hostPath);
    // Receive messages at the websocket connection
    this._socket.onmessage = this.on_message.bind(this);
    // Resolve if opens and reject if closes
    this._socket.onopen = this.on_open.bind(this, resolve);
    this._socket.onclose = this.on_close.bind(this, reject);
  }
  catch (e) {
    reject('No open socket.');
  }
};

EditorSocket.prototype.send = function(resolve, reject, m) {
  // Try to create a new socket
  if (this._socket === undefined) {
    var reopen = this.open.bind(this);
    var resend = this.send.bind(this, resolve, reject, m);
    // Call function again with new socket
    var openPromise = new Promise(reopen);
    openPromise.then(resend).catch(reject);
    return;
  }
  // Send via this socket
  try {
    this._socket.send(m);
    resolve('Message sent.');
  }
  catch (e) {
    reject('Message error.');
  }
};

/*
 * Private Methods
 */

EditorSocket.prototype._formatPath = function() {
  // Make a path for a specitfic channel
  var {host, key, channel} = this._editorLayer.editorSource;
  // Use ws if http and wss if https
  var wss = 'ws'+location.protocol.substr(4).split(':')[0];
  return `${wss}://${host}/ws/${key}/${channel}`;
};

EditorSocket.prototype.on_message = function(m) {
  // Send incoming message to editor
  this._editorLayer.handleMessage(m.data);
};

EditorSocket.prototype.on_open = function(resolve, lol) {
  // Resolve the promise of an open socket
  resolve('Established websocket.');
};

EditorSocket.prototype.on_close = function(reject) {
  // Remove the reference to this websocket
  this._socket = undefined;
  reject('Websocket dropped.');
};

/*
 * Export as module to convert to typescript
 */
if (typeof exports !== "undefined") {
  module.exports = {
    EditorSocket: EditorSocket,
  };
}
