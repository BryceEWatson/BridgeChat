/*  Websocket Manager Class
	Description: Handles all websocket communications, allows a controller class to bind the receive
				 method to a local function. Will initialize and connect websocket to provided destination
*/
// Global Variables
var ws,largeMsg,sQ = [];
var recvCallback;

// Utility Function
Array.prototype.pushStr = function (str) {
    var n = str.length;
    for (var i=0; i < n; i++) {
        this.push(str.charCodeAt(i));
    }
}

/* Websocket Constructor */
function WebsocketManager (host, port, binaryData) {
	this.host = host;
	this.port = port;
	this.binary = binaryData;

/* Initialize Websock object */
	this.init = function(recvFunction, openFunction, closeFunction, onError) {
		recvCallback = recvFunction; // Called after msg compiled from do_recv..
		if(!ws) {
			if(this.binary) {
				// Using binary websock library for Proxy
				ws = new Websock();
				ws.on('message', do_recv);
				ws.on('open', openFunction);
				ws.on('close', closeFunction);
				ws.on('error', onError);
			} else {
				if(window.MozWebSocket) {
					window.WebSocket = window.MozWebSocket;
				}
				// Regular websocket
				ws = new WebSocket("ws://192.168.0.103:8888");
				ws.onopen = openFunction;
				ws.onmessage = recvCallback;
				ws.onclose = closeFunction;
			}
			
		}
	}

	// Called only if using binary websock
	this.connectWS = function() {
		console.log(">> connect");
		var scheme = "ws://", uri;
		if ((!host) || (!port)) {
			alert("must set host and port");
			return false;
		}
		if (ws) {
			ws.close();
		}
		uri = scheme + host + ":" + port;
		console.log("connecting to " + uri);
		ws.open(uri);
		console.log("<< connect");
		return true;
	}
	
	this.disconnectWS = function() {
		ws.close();
	}
	// Collects raw data off the recv queue
	function do_recv() {
		console.log(">> do_recv");
		if(ws.rQlen() >= 1024) {
			moreMsgs = true;
		} else {
			moreMsgs = false;
		}
		var arr = ws.rQshiftBytes(ws.rQlen()), chr;
		while (arr.length > 0) {
			chr = arr.shift();
			largeMsg += String.fromCharCode(chr);    
		}
		if (!moreMsgs) {
			console.log("<< do_recv = " + largeMsg);
			recvCallback(largeMsg);
			largeMsg = "";
		}
	}
	// Call this to send more than one message at a time
	// Use sendMessage() when ready to actually send entire queue.
	this.addToSendQueue = function(message) {
		sQ.pushStr(message);
	}
	
	this.sendMessage = function(message) {
		console.log("Sending: " + message);
		if(this.binary) {
			sQ.pushStr(message);
			if (sQ.length > 0) {
				//console.log("Sending " + sQ);
				ws.send(sQ);
				sQ = [];
			}
		} else {
			ws.send(message);
		}
	}
}
