// var klass = require('klass');
// var ajax = require('ajax');
XMLHttpRequest = typeof XMLHttpRequest === 'undefined' ? require("xmlhttprequest").XMLHttpRequest : XMLHttpRequest;
var WebSocket = require('ws');
var Promise = require('es6-promise').Promise;
var EventEmitter = require('events').EventEmitter;
module.exports = WebClient;

function WebClient(settings) {
  if (this instanceof WebClient == false) {
    return new WebClient(settings)
  }
  var _emitter, connectionStatus, _settings, _waitCommands, watchingPeer, server, ws;

  function initialize(settings) {
    if (!settings) throw new Error('settings')
    if (!settings.appId) throw new Error('settings.appId')
    if (!settings.peerId) throw new Error('settings.peerId')
    _settings = settings || {};
    _waitCommands = [];
    _emitter = new EventEmitter();
    watchingPeer = [].concat(settings.watchingPeer);
    connectionStatus = "notconnected";
  }
  initialize(settings);

  function _getServerInfo(appId) {
    var url = 'http://router.g0.push.avoscloud.com/v1/route?appId=' + appId + '&secure=1';
    return get(url);
  }

  function _connect() {
    if (server && new Date() < server.expires) {
      return new Promise(function(resolve, reject) {
        ws = new WebSocket(server.server);
        ws.onopen = function() {
          connectionStatus = 'connected';
          resolve(server);
        };
        ws.onclose = function() {
          connectionStatus = 'closed';
          if (_waitCommands.length > 0 && _waitCommands[0][0] === 'close') {
            _waitCommands.shift()[1]();
          }
        }
        ws.onmessage = function(message) {
          var data = JSON.parse(message.data);
          if (data.cmd == 'session') {
            if(data.op == 'opened'){
              _keepAlive();
            }
            if (data.op == 'opened'||data.op == 'added') {
              _emitter.emit('onlinePeers', data.onlineSessionPeerIds);
            }

          } else if (data.cmd == 'presence') {
            if (data.status == 'on') {
              _emitter.emit('onlinePeers', data.sessionPeerIds);
            } else if (data.status == 'off') {
              _emitter.emit('offlinePeers', data.sessionPeerIds);
            }
          } else if (data.cmd == 'direct') {
            _emitter.emit('message', {
              msg: data.msg,
              fromPeerId: data.fromPeerId
            });
            var msg = {
              "cmd": "ack",
              "peerId": _settings.peerId,
              "appId": _settings.appId,
              'ids': [].concat(data.id)
            }
            var s = JSON.stringify(msg)
            ws.send(s);
          }

          var cmd = data.op ? data.cmd + data.op : data.cmd;
          if (_waitCommands.length > 0 && _waitCommands[0][0] === cmd) {
            _waitCommands.shift()[1](data);
          }
        };
      });
    } else {
      return _getServerInfo(_settings.appId).then(function(result) {
        server = JSON.parse(result);
        server.expires = Date.now() + server.ttl * 1000;
        return _connect();
      });
    }
  }

  function _openSession() {
    var msg = {
      "cmd": "session",
      "op": "open",
      "sessionPeerIds": _settings.watchingPeer,
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    var s = JSON.stringify(msg)
    ws.send(s);
    return _wait('sessionopened');
  }

  function _wait(command) {
    return new Promise(function(resolve, reject) {
      _waitCommands.push([command, resolve, reject]);
    });
  }

  function _keepAlive(){
    clearTimeout(_keepAlive.handle);
    _keepAlive.handle = setTimeout(function(){
      ws.send('{}');
      _keepAlive();
    },1000*60);
  }
  this.open = function() {
    if (connectionStatus == 'connecting') {
      return Promise.reject('should not call open again while  already call open method');
    } else if (connectionStatus == 'connected') {
      return Promise.resolve();
    }
    connectionStatus = 'connecting';
    return _connect().then(function() {
      return _openSession();
    });
  };
  this.close = function() {
    connectionStatus = 'closed';
    var msg = {
      "cmd": "session",
      "op": "close",
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    ws.send(JSON.stringify(msg));
    ws.close();
    clearTimeout(_keepAlive.handle);
    return _wait('close');
  }
  this.send = function(msg, to) {
    if (connectionStatus != 'connected') {
      return Promise.reject('can not send msg while not connected');
    }
    _keepAlive();
    var msg = {
      "msg": msg,
      "cmd": "direct",
      "toPeerIds": [].concat(to),
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    ws.send(JSON.stringify(msg));
    return _wait('ack');
  };

  this.on = function(name, func) {
    _emitter.on(name, func)
  };
  this.addWatchingPeer = function(watchingPeer) {

    if(connectionStatus!='connected'){
      Promise.reject('can not add watchingPeer while not connected');
    }
    _keepAlive();
    var msg = {
      "cmd": "session",
      "op": "add",
      "sessionPeerIds": [].concat(watchingPeer),
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    ws.send(JSON.stringify(msg));
    return _wait('sessionadded');
  }
  this.removeWatchingPeer = function(watchingPeer) {
    if(connectionStatus!='connected'){
      Promise.reject('can not add watchingPeer while not connected');
    }
    _keepAlive();
    var msg = {
      "cmd": "session",
      "op": "remove",
      "sessionPeerIds": [].concat(watchingPeer),
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    ws.send(JSON.stringify(msg));
    return Promise.resolve();
  }
  this.getPeerStatus = function(watchingPeer) {
    if(connectionStatus!='connected'){
      Promise.reject('can not add watchingPeer while not connected');
    }
    var msg = {
      "cmd": "session",
      "op": "query",
      "sessionPeerIds": [].concat(watchingPeer),
      "peerId": _settings.peerId,
      "appId": _settings.appId
    }
    ws.send(JSON.stringify(msg));
    return _wait('sessionquery-result');
  }


};



function get(url) {
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);
    // req.withCredentials = false;
    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.responseText);
      } else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };
    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });
}
// var con = new Connection();

// var chat = new Chat(2);
// getServerInfo();