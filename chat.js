var klass = require('klass');
var ajax = require('ajax');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var WebSocket = require('ws');
var Promise = require('es6-promise').Promise


var WebClient = klass(function (){
  console.log("Connection" )
}).methods({
  initialize: function(settings){
    this._settings = settings || {};
    console.log("initialize Connection");
    this._connect().then(function(){
      this._openSession()
    }.bind(this));
  },
  _getServerInfo: function(appId){
    var url = 'http://router.g0.push.avoscloud.com/v1/route?appId='+appId+'&secure=1';
    return get(url);
  },
  _connect: function(){
    console.log("connect")
    var server = this.server
    console.log(server)
    if (server && new Date() < server.expires){
      return new Promise(function(resolve,reject){
        console.log("new websocket"+server.server)
        this.ws = new WebSocket(server.server);
        this.ws.onopen = function () {
          console.log("onopen")
          resolve(this);
        }
        this.ws.onmessage = function(message){
          console.log("onmessage",message)
        }
        // resolve(this);
      }.bind(this));
    }else{
      return this._getServerInfo(this._settings.appId).then(function(result){
        this.server = JSON.parse(result);
        this.server.expires = Date.now() + this.server .ttl * 1000;
        return this._connect();
      }.bind(this))
    }
  },
  _openSession: function() {
    console.log("_openSession")
    var msg = {"cmd": "session",
         "op": "open",
         "sessionPeerIds": ["..."],
         "peerId": this._settings.peerId,
         "appId": this._settings.appId
         }
    var s = JSON.stringify(msg)
    this.ws.send(s)
    console.log("send"+s)
  },
  sendMsg: function(msg) {

  }
});




function get(url) {
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.responseText);
      }
      else {
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
var appid = '28ferwlg9sncja6qw9ede6ruomjfed7lex4dljhlg80u23xl';
var peerId = 'abc'
var chat = new WebClient({
  appId: appid,
  peerId: peerId
});
// var chat = new Chat(2);
// getServerInfo();

