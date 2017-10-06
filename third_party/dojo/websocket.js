var dojoWebsocket = function(viewer, hostname) {

  this._socket = null;
  this._viewer = viewer;

  this.connect();

  try {

    var host = "ws://"+hostname+"/ws";  
    this._socket = new WebSocket(host);

    this._socket.onopen = this.on_open.bind(this);
    this._socket.onmessage = this.on_message.bind(this);
    this._socket.onclose = this.on_close.bind(this);

  } catch (e) {
    console.log('Websocket connection failed.');
  }

};

dojoWebsocket.prototype.on_open = function() {

  console.log('Established websocket connection.');

};

dojoWebsocket.prototype.on_message = function(m) {

  this._viewer.handleMessage(m);

};

dojoWebsocket.prototype.send = function(m) {

  this._socket.send(m);

};

dojoWebsocket.prototype.on_close = function() {

  console.log('Websocket connection dropped.');

};
