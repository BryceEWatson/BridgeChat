var ws, sQ = [],
    state = "unconnected";
var host = "jabber.org";
var userName = ""; // Ex. bridgetest1
var jid = ""; // Your website's user account
var password = "p4bridgetest";
var bridgeClient = "BridgeClient";
var chatRoomName = "bridgetestchat2";
var chatNick = "";
var totalStreams = 0;
var localStream;
var moreMsgs = false;
var largeMsg = "";
var disconnectStanza = "<presence type='unavailable'><status>Logged out</status></presence>";
var streamStanza = "<?xml version='1.0'?>  <stream:stream to='jabber.org' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' xmlns:tls='http://www.ietf.org/rfc/rfc25295.txt' version='1.0'>";
//var resourceBindingStanza = '<iq type="set" id="bind_1"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>'+clientName+'</resource></bind></iq>';
var clientUser = ""; // example: bridgetest1@jabber.org/BridgeClient
var clientID = "";
var doPlainLogin = true;
var chatSessions = {};

window.onload=function(){
	// Set the domain label
	document.getElementById("domainLbl").innerHTML = "<i>@"+host+"</i>";
}

	
function loginClicked() {
	
	if(state.indexOf("unconnected") !== -1) {
		chatNick = document.getElementById("userNameBox").value;
		chatSessions[0] = new ChatSession(0,"",chatNick,chatRoomName.toLowerCase(),"Global Chat",false);
		chatSessions[0].users = {};
		chatSessions[0].userName = document.getElementById("userNameBox").value;;
		// Startup
		initWebsocket(); // Create websocket
		connectWS("192.168.0.103","8888", false, "testNick", "testChannel");
		// Initiate login
		userName = document.getElementById("jidBox").value;
		jid = userName + "@" + host;
		
		
	} else if (state.indexOf("connected") !== -1) {
		// Disconnect Stream
		if(chatSessions[1]) {
			sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[1].roomName+"@conference.jabber.org/"+chatNick,clientId));
		}
		sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[0].roomName+"@conference.jabber.org/"+chatNick,clientId));
		sendCmd(buildDisconnectStanza());
		state = "unconnected";
		updateUIState();
		chatSessions[0].users = {}; // clear
		updateUserList();
	}
}

function msgSendClicked() {
	var message = document.getElementById("chatInputTxt").value;
	sendCmd(buildMessageStanza(clientUser,chatRoomName+"@conference."+host,clientId,message));
}

function inviteUserClicked(nick) {
	// 1. Create a new session OR add user to existing session
	if(!chatSessions[1]) {
		var roomName = nick + Math.floor(Math.random()*9000);
		chatSessions[1] = new ChatSession("","",chatNick,roomName.toLowerCase(),"Chat With "+nick,false);
		chatSessions[1].users = {};
		// No need to add user here, do it when he joins
	} else {
		// Already in a chat, nothing to do but wait.
	}
	// 2. Make sure we are connected to the new session!
	if(!chatSessions[1].connected) { // Need to connect first
		// Join Chat Session
		clientUser = jid+"/"+bridgeClient;
		console.log("chatSessions[1].roomName>> " + chatSessions[1].roomName);
		sQ.pushStr(buildPresenseStanza(clientUser,chatSessions[1].roomName+"@conference.jabber.org/"+chatNick,clientId));
	} 
	// Send our invite to join the new room
	// 3. Send out invitation to the user!
	var msgContent = "JSON>>";
	var jsonContent = {
		type: 'session-offer',
		roomName: chatSessions[1].roomName,
	};
	msgContent += JSON.stringify(jsonContent);
	sendCmd(buildMessageStanza(clientUser,chatSessions[0].roomName+"@conference."+host+"/"+nick,clientId,msgContent,"chat"));
	
}


// Request WebRTC sessions with each user
// userNick must not == self.
function initiateWebRTCSession(userNick) {
	console.log("userNick >> " + userNick);
	//console.log("chatSessions[1].users[userNick]>> " + chatSessions[1].users[userNick]["pc"]);
	if(!chatSessions[1].users[userNick]["pc"]) {
		//console.log("RTCPeerConnection_>> " + RTCPeerConnection); 
		chatSessions[1].users[userNick]["pc"] = new RTCPeerConnection(chatSessions[1].pc_config,function(candidate) {
			
		});
		chatSessions[1].users[userNick]["pc"].addStream(localStream);
		//var pc = chatSessions[1].createPeerConnection(userNick);
		chatSessions[1].users[userNick]["pc"].onicecandidate = function(evt) {
			console.log("Got Candidate>> " + evt);
			if (evt.candidate) {
				// Save candidate to send out
				chatSessions[1].users[userNick]["candidate"] = evt.candidate;
				// Send candidate to each user privately
				var msgContent = "JSON>>";
				var jsonContent = {
					type: 'candidate',
					label: evt.candidate.sdpMLineIndex,
					id: evt.candidate.sdpMid,
					candidate: evt.candidate
				};
				msgContent += JSON.stringify(jsonContent);
				sendCmd(buildMessageStanza(clientUser,chatRoomName+"@conference."+host+"/"+userNick,clientId,msgContent,"chat"));
			} else {
				console.log("End of candidates.");
			}
		};
		// once remote stream arrives, show it in the remote video element
		chatSessions[1].users[userNick]["pc"].onaddstream = function (evt) {
			console.log("Displaying stream for>> " + userNick);
			displayStream(userNick,evt.stream);
		};
	}
}
// We want to accept a user's invitation
function inviteAcceptClk(userNick,roomName) {
	// 1. Clear any existing chat sessions
	// TODO: Add a warning?
	chatSessions[1] = new ChatSession(1,"",chatNick,roomName.toLowerCase(),"Chat With " + userNick,false);
	// 2. Join the user's chat room
	clientUser = jid+"/"+bridgeClient;
	sendCmd(buildPresenseStanza(clientUser,chatSessions[1].roomName+"@conference.jabber.org/"+chatNick,clientId));
}
	
/* Initialize Websock object */
function initWebsocket() {
	if(!ws) {
		ws = new Websock();

		ws.on('message', do_recv);
		ws.on('open', function(e) {
			console.log(">> WebSockets.onopen");
			sendCmd(buildQueryStanza(jid.split('@')[1],"http://etherx.jabber.org/streams"));
		});
		ws.on('close', function(e) {
			// Disconnect Stream
			sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[0].roomName+"@conference.jabber.org/"+chatNick,clientId));
			if(chatSessions[1]) {
				sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[1].roomName+"@conference.jabber.org/"+chatNick,clientId));
			}
			sendCmd(buildDisconnectStanza());
			state = "unconnected";
			updateUIState();
			chatSessions[0].users = {};
			updateUserList();
			console.log(">> WebSockets.onclose");
			disconnect();
			console.log("<< WebSockets.onclose");
		});
		ws.on('error', function(e) {
			// Disconnect Stream
			sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[0].roomName+"@conference.jabber.org/"+chatNick,clientId));
			if(chatSessions[1]) {
				sendCmd(buildDisconnectPresenseStanza(clientUser,chatSessions[1].roomName+"@conference.jabber.org/"+chatNick,clientId));
			}
			sendCmd(buildDisconnectStanza());
			
			state = "unconnected";
			updateUIState();
			chatSessions[0].users = {};
			updateUserList();
			document.getElementById("messages").innerHTML = e.value;
			console.log(">> WebSockets.onerror");
			disconnect();
		});
	}
}

function connectWS(host, port, encrypt, nick, channel) {
    var host = host,
        port = port,
        scheme = "ws://", uri;

    irc_nick = nick;
    irc_channel = channel;

    console.log(">> connect");
    if ((!host) || (!port)) {
        alert("must set host and port");
        return false;
    }

    if (ws) {
        ws.close();
    }

    if (encrypt) {
        scheme = "wss://";
    }
    uri = scheme + host + ":" + port;
    console.log("connecting to " + uri);

    ws.open(uri);

    console.log("<< connect");

    return true;
}

function do_recv() {
    console.log(">> do_recv");
	
    //var rQ, rQi, i;
	//console.log("ws.get_rQi()>> " + ws.get_rQi());
	//console.log("ws.rQlen()>> " + ws.rQlen());
	if(ws.rQlen() >= 1024) {
		moreMsgs = true;
	} else {
		moreMsgs = false;
	}
	//var str = ws.rQshiftStr();
    var arr = ws.rQshiftBytes(ws.rQlen()), chr;
	//console.log("arr>> " + arr);
	while (arr.length > 0) {
		chr = arr.shift();
		//console.log("adding char>> " + String.fromCharCode(chr));
		largeMsg += String.fromCharCode(chr);    
	}
		//console.log("ws.rQlen()>> " + ws.rQlen());
	if (!moreMsgs) {
		recvMsg(largeMsg);
		largeMsg = "";
	}
    //}
    //console.log("<< do_recv");
}

function do_send() {
	console.log("sQ.length >> " + sQ.length);
    if (sQ.length > 0) {
        //console.log("Sending " + sQ);
        ws.send(sQ);
        sQ = [];
    }
}

function sendCmd(msg) {
	//msg = encodeURIComponent(msg)
    console.log("Sending: " + msg);
	sQ.pushStr(msg);
    do_send();
}

// Handle the message..
function recvMsg(msg) {
	//msg = decodeURIComponent(msg);
    console.log(">> recvMsg('" + msg + "')");
	
	if(msg.indexOf("<mechanism>PLAIN</mechanism>") !== -1 && doPlainLogin) { // Do PLAIN auth, Step 1
		var userPW = document.getElementById("pwBox").value;
		var passwordPlainStanza = chatSessions[0].calculatePlainStanza(jid,userPW);
		sendCmd(passwordPlainStanza);
	}
	
	if(msg.indexOf("<stream:error") !== -1) { // Login Error
		document.getElementById("messages").innerHTML = "Login Error: Check JID / Password from " + host;
	}
	
	if(msg.indexOf("<success") !== -1) { // Login success
		// Update UI to show connected.
		state = "connected";
		updateUIState();
		// Request stream details.
		sendCmd(buildQueryStanza(jid.split('@')[1],"http://etherx.jabber.org/streams"));
	}
	
	if(msg.indexOf("<bind xmlns=") !== -1 && msg.indexOf("<required/>") !== -1) { // Server requires session binding
		// Get the user ID for this login.
		var index = msg.indexOf("id='") + 4;
		var idString = msg.substring(index,msg.length);
		index = idString.indexOf("'");
		idString = idString.substring(0, index);
		clientId = idString;
		console.log("idString>> " + idString);
		chatSessions[0].sessionId = clientId;
		sendCmd(buildBindStanza(bridgeClient,1));
	}
	
	if(msg.indexOf("</jid></bind></iq>") !== -1) { // Binding complete TODO: Find a better check
		// Join Main Chat Session
		clientUser = jid+"/"+bridgeClient;
		sendCmd(buildPresenseStanza(clientUser,chatRoomName+"@conference.jabber.org/"+chatNick,clientId));
	}
	
	if(msg.indexOf("<presence") !== -1 && state == "connected") {
		msg = "<holder>" + msg + "</holder>";
		var xmlMsgDoc = $.parseXML(msg);
		var $xmlMsg = $(xmlMsgDoc);
		var newVideoSession = false;
		var newChatSession = false;
		
		
		// Which session did this presence come from?
		$xmlMsg.find("presence").each(function(index) {
			var from = $(this).attr("from");
			if(from && from.split("@")[0]) {
				// Any Chat Sessions?
				var fromRoom = from.split("@")[0];
				console.log("fromRoom >> " + fromRoom);
				if(chatSessions[1]) { console.log("chatSessions[1].roomName>> " + chatSessions[1].roomName); }
				if(chatSessions[0].roomName == fromRoom) {
					chatSessions[0].processPresence(msg);
				} else if (chatSessions[1] && chatSessions[1].roomName == fromRoom) {
					var wasConnected = chatSessions[1].connected;
					chatSessions[1].processPresence(msg);
					console.log("wasConnected>> " + wasConnected);
					if ( !wasConnected && chatSessions[1].connected) {
						// First connection to session
						console.log("newVideoSession");
						newVideoSession = true;
					}
				}
			}
		});
		
		// We just joined a new room for the first time
		// Create our WebRTC Object & Send Offers To Any Existing Members
		if (newVideoSession) {
			try {
			// Start our Local WebRTC Stream
			//console.log("navigator.getUserMedia_>> " + navigator.getUserMedia_);
			getUserMedia({video:true,audio:true}, gotLocalStream,streamFailed);
			
			
			} catch(err) {
				console.log("Error Getting Local Video: " + err.message);
			}
		}
		// Update Global Chat List
		updateUserList();
		// Update Session Chat??
		
	}
	
	if(msg.indexOf("<ping") !== -1) {
		// Respond with a pong!
		sendCmd(buildPingStanza(clientUser,host,clientId));
	}
	
	if(msg.indexOf("<message") !== -1) {
		msg = "<holder>" + msg + "</holder>";
		var xmlMsgDoc = $.parseXML(msg);
		var $xmlMsg = $(xmlMsgDoc);
		var type = $xmlMsg.find("message").attr("type");
		var fromNick = $xmlMsg.find("message").attr("from").split("/")[1];
		$xmlMsg.find("body").each(function() {
			if($(this).text().indexOf("JSON>>") !== -1) {
				var jsonString = $(this).text().split(">>")[1];
					//console.log("jsonString>> " + jsonString);
					var jsonContent = JSON && JSON.parse(jsonString) || $.parseJSON(jsonString);
					if(jsonContent.type && jsonContent.type == "candidate") {
						initiateWebRTCSession(fromNick);
						chatSessions[1].users[fromNick]["pc"].addIceCandidate(new RTCIceCandidate(jsonContent.candidate));
					}
					if(jsonContent.type && jsonContent.type == "sdp") {
						// Create PeerConnection & Assign listeners
						initiateWebRTCSession(fromNick);
						console.log("Setting RemoteDescription as Answerer");
						var offerSPD = new RTCSessionDescription(jsonContent.sdp);
						console.log("Made the offerSPD>> " + offerSPD);
						chatSessions[1].users[fromNick]["pc"].setRemoteDescription(offerSPD, function() {
							console.log("Remote Description Set!");
						});
						// Create the answer.
						console.log("Creating Answer SDP");
						chatSessions[1].users[fromNick]["pc"].createAnswer(function(answerSDP) {
							chatSessions[1].users[fromNick]["pc"].setLocalDescription(answerSDP);
							// Send Answer back
							var msgContent = "JSON>>";
							var jsonContent = {
								type: 'sdp-answer',
								sdp: chatSessions[1].users[fromNick]["pc"].localDescription
							};
							msgContent += JSON.stringify(jsonContent);
							sendCmd(buildMessageStanza(clientUser,chatSessions[1].roomName+"@conference."+host+"/"+fromNick,clientId,msgContent,"chat"));
						});
					}
					if(jsonContent.type && jsonContent.type == "sdp-answer") {
						chatSessions[1].users[fromNick]["pc"].setRemoteDescription(new RTCSessionDescription(jsonContent.sdp));
					}
					if(jsonContent.type && jsonContent.type == "session-offer") {
						// Got an invite to a chat!
						// Send invitation msg to main chat window!
						var invitationMsg = "INVITED by " + fromNick + " to chat!" +
							"<button id='chatInv-" + fromNick + "' onclick='inviteAcceptClk(\""+fromNick+"\",\""+jsonContent.roomName+"\")'>Accept</button>";
						var body = invitationMsg;
						document.getElementById("chatHistory").innerHTML += "<div class='msgLine'>" + fromNick + ">> " + body + "</div>";
					}
				
			} else {
				document.getElementById("chatHistory").innerHTML += "<div class='msgLine'>" + fromNick + ">> " + body + "</div>";
			}
		});
	}
}

function gotLocalStream(stream){
	console.log("Got Stream!");
	var mainView = document.getElementById("mainView-1");
	mainView.muted = true;
	attachMediaStream(mainView, stream);
	localStream = stream;
	//mainView.src = URL.createObjectURL(stream);
	//chatSessions[1].localStream = stream;
	// Create PeerConnections & Send Connection Details for all Users currently in chat
	$.each(chatSessions[1].users,function(userNick,user) {
		// Make sure it's not us.
		if(!user["self"] ) {
			// No Peer Connection Yet!
			console.log("gotLocalStream >> userNick >> " + userNick);
			initiateWebRTCSession(userNick);
			console.log("finished initiating RTC");
			user["pc"].addStream(stream);
			console.log("Stream added locally, create offer..");
			var offerSPD = user["pc"].createOffer(function(offerDesc){
				console.log("Offer created! Set local description!");
				user["pc"].setLocalDescription(offerDesc);
				var msgContent = "JSON>>";
				var jsonContent = {
					type: 'spd',
					sdp:user["pc"].localDescription
				};
				msgContent += JSON.stringify(jsonContent);
				sendCmd(buildMessageStanza(clientUser,chatRoomName+"@conference."+host+"/"+userNick,clientId,msgContent,"chat"));
			});
		}
	});
}

function displayStream(userName,stream) {
	// make sure we don't already have a stream for this user.
	var userVid = document.getElementById("miniView-"+userName);
	if(!userVid) {
		// Doesn't exist yet, so add to the bottom bar
		var bottomBar = document.getElementById("bottomBar");
		bottomBar.innerHTML += "<video id='miniView-"+userName+"' width='200px' height='200px' autoplay='autoplay'/>";
		// Now attach the stream
		var newVideo = document.getElementById("miniView-" + userName);
		attachMediaStream(newVideo, stream);
	}
}

function countPeerConnections() {
	// How many external streams?
	$.each(chatSessions[1].users,function(userNick,user) {
		if(!user["self"] && user["pc"]) {
			totalStreams++;
		}
	});
}

function streamFailed(errorEntity) {
	console.log("The following error occured: " + errorEntity.code);
}

function updateVideoChatUI() {
	// Are we connected yet?
	if(chatSessions[1].available) {
		// Do we have enough video elements for users?
		
	}
}

function updateUIState() {
	if(state.indexOf("unconnected") !== -1) {
		// Show connection box
		var connectionHolder = document.getElementById("connection");
		connectionHolder.innerHTML = ""; // clear
		connectionHolder.innerHTML = 'JID:<input id="jidBox" value="'+userName+'"></input><span id="domainLbl"></span></br>Password:<input id="pwBox" value="p4bridgetest"></input>Nick:<input id="userNameBox"></input>';//'JID:<input id="jidBox" value="'+userName+'"></input><span id="domainLbl"><i>@'+host+'</i></span>Nick Name:<input id="userNameBox" value="'+chatNick+'"></input>';
		// Update login button
		var btnHolder = document.getElementById("loginHolder");
		btnHolder.innerHTML = ""; // clear
		btnHolder.innerHTML = '<button id="loginBtn" onclick="loginClicked();">Login</button>';
	} else if (state.indexOf("connected") !== -1) {
		// User details box
		var connectionHolder = document.getElementById("connection");
		connectionHolder.innerHTML = ""; // clear
		connectionHolder.innerHTML = "<div id='connectionTxt'>JID: "+jid+"</div>";
		// Update login button
		var btnHolder = document.getElementById("loginHolder");
		btnHolder.innerHTML = ""; // clear
		btnHolder.innerHTML = '<button id="loginBtn" onclick="loginClicked();">Disconnect</button>';
	}
}

function updateUserList() {
	var userList = document.getElementById("userList");
	userList.innerHTML = "";//clear
	var userDiv = "";
	$.each(chatSessions[0].users,function(key,value) {
		// Remove any expired Users, or add new ones.
		if (value["available"] == true) {
			if (value["self"] == true) {
				// This is us.
				userDiv += "<div class='selfDiv'><i>"+value["nick"]+"</i></div>";
			} else {
				// Another user.
				userDiv += "<div id='userDiv-"+value["nick"]+"' class='userDiv'>"+value["nick"]+"</div>";
				userDiv += "<button id='userBtn-"+value["nick"]+"' class='userInvBtn' onclick='inviteUserClicked(\""+value["nick"]+"\")'>Invite</button>";
			}
		} else {
			// Remove unavailable user from UI
			$("userDiv-"+value["nick"]).remove();
			$("userBtn-"+value["nick"]).remove();
		}
	});
	userList.innerHTML = userDiv;
}


function buildQueryStanza(domain, stream) {
	return '<?xml version="1.0"?>\n\n<stream:stream xmlns:stream="'+stream+'" version="1.0" xmlns="jabber:client" to="'+domain+'" xml:lang="en" xmlns:xml="http://www.w3.org/XML/1998/namespace">';
}
function buildDiscoStanza(clientUser,domain, id) {
	return "<iq from='"+clientUser+"' id='"+id+"' to='"+domain+"' type='get'> <query xmlns='http://jabber.org/protocol/disco#items'/> </iq>";
}
function buildPresenseStanza(from,to,id) {
	return "<presence from='"+from+"' id='"+id+"' to='"+to+"'><x xmlns=’http://jabber.org/protocol/muc’/></presence>";
}
function buildDisconnectPresenseStanza(from,to,id) {
	return "<presence from='"+from+"' id='"+id+"' to='"+to+"' type='unavailable'></presence>";
}
function buildBindStanza(bindName,bindNum) {
	return '<iq type="set" id="bind_'+bindNum+'"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>'+bindName+'</resource></bind></iq>';
}
function buildDisconnectStanza() {
	return '</stream:stream>';
}
function buildMessageStanza(userJID,chatServer,id,msg,type) {
	return "<message from='"+userJID+"' id='"+id+"' to='"+chatServer+"' type='"+type+"'><body>"+msg+"</body></message>";
}
function buildPingStanza(userJID,host,id) {
	return "<iq from='"+userJID+"' to='"+host+"' id='"+id+"' type='result'/>";
}

function hex2a(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
        str += parseInt(hex.substr(i, 2), 16);
		//alert(hex.substr(i, 2) + " : " + parseInt(hex.substr(i, 2), 16));
	}
    return str;
}

Array.prototype.pushStr = function (str) {
    var n = str.length;
    for (var i=0; i < n; i++) {
        this.push(str.charCodeAt(i));
    }
}

function disconnect() {
	//sendCmd(disconnectStanza);
    console.log(">> disconnect");
	
    if (ws) {
        ws.close();
    }

    console.log("<< disconnect");
}

function encode64(input) {
	var keyStr = "ABCDEFGHIJKLMNOP" +
               "QRSTUVWXYZabcdef" +
               "ghijklmnopqrstuv" +
               "wxyz0123456789+/" +
               "=";

     //input = escape(input);

     var output = "";

     var chr1, chr2, chr3 = "";

     var enc1, enc2, enc3, enc4 = "";
     var i = 0;
 
     do {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);
 
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
 
        if (isNaN(chr2)) {
           enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
           enc4 = 64;
        }
 
        output = output +
           keyStr.charAt(enc1) +
           keyStr.charAt(enc2) +
           keyStr.charAt(enc3) +
           keyStr.charAt(enc4);
        chr1 = chr2 = chr3 = "";
        enc1 = enc2 = enc3 = enc4 = "";
     } while (i < input.length);
 
     return output;
  }
  
  function decode64(input) {
	 var keyStr = "ABCDEFGHIJKLMNOP" +
               "QRSTUVWXYZabcdef" +
               "ghijklmnopqrstuv" +
               "wxyz0123456789+/" +
               "=";
     var output = "";
     var chr1, chr2, chr3 = "";
     var enc1, enc2, enc3, enc4 = "";
     var i = 0;
 
     // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
     var base64test = /[^A-Za-z0-9\+\/\=]/g;
     if (base64test.exec(input)) {
        alert("There were invalid base64 characters in the input text.\n" +
              "Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='\n" +
              "Expect errors in decoding.");
     }
     //input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
 
     do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));
 
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
 
        output = output + String.fromCharCode(chr1);
 
        if (enc3 != 64) {
           output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
           output = output + String.fromCharCode(chr3);
        }
 
        chr1 = chr2 = chr3 = "";
        enc1 = enc2 = enc3 = enc4 = "";
 
     } while (i < input.length);
 
     return unescape(output);
  }

  function bin2String(array) {
	  var result = "";
	  for (var i = 0; i < array.length; i++) {
		result += String.fromCharCode(parseInt(array[i], 2));
	  }
	  return result;
  }
  
  /*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Copyright (C) Paul Johnston 1999 - 2000.
 * Updated by Greg Holt 2000 - 2001.
 * See http://pajhome.org.uk/site/legal.html for details.
 */
 
/*
 * Convert a 32-bit number to a hex string with ls-byte first
 */
var hex_chr = "0123456789abcdef";
function rhex(num)
{
  str = "";
  for(j = 0; j <= 3; j++)
    str += hex_chr.charAt((num >> (j * 8 + 4)) & 0x0F) +
           hex_chr.charAt((num >> (j * 8)) & 0x0F);
  return str;
}
 
/*
 * Convert a string to a sequence of 16-word blocks, stored as an array.
 * Append padding bits and the length, as described in the MD5 standard.
 */
function str2blks_MD5(str)
{
  nblk = ((str.length + 8) >> 6) + 1;
  blks = new Array(nblk * 16);
  for(i = 0; i < nblk * 16; i++) blks[i] = 0;
  for(i = 0; i < str.length; i++)
    blks[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
  blks[i >> 2] |= 0x80 << ((i % 4) * 8);
  blks[nblk * 16 - 2] = str.length * 8;
  return blks;
}
 
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally 
 * to work around bugs in some JS interpreters.
 */
function add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}
 
/*
 * Bitwise rotate a 32-bit number to the left
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}
 
/*
 * These functions implement the basic operation for each round of the
 * algorithm.
 */
function cmn(q, a, b, x, s, t)
{
  return add(rol(add(add(a, q), add(x, t)), s), b);
}
function ff(a, b, c, d, x, s, t)
{
  return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function gg(a, b, c, d, x, s, t)
{
  return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function hh(a, b, c, d, x, s, t)
{
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a, b, c, d, x, s, t)
{
  return cmn(c ^ (b | (~d)), a, b, x, s, t);
}
 
/*
 * Take a string and return the hex representation of its MD5.
 */
function calcMD5(str,toHex)
{
  x = str2blks_MD5(str);
  a =  1732584193;
  b = -271733879;
  c = -1732584194;
  d =  271733878;
 
  for(i = 0; i < x.length; i += 16)
  {
    olda = a;
    oldb = b;
    oldc = c;
    oldd = d;
 
    a = ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i+10], 17, -42063);
    b = ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = ff(d, a, b, c, x[i+13], 12, -40341101);
    c = ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = ff(b, c, d, a, x[i+15], 22,  1236535329);    
 
    a = gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = gg(c, d, a, b, x[i+11], 14,  643717713);
    b = gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = gg(c, d, a, b, x[i+15], 14, -660478335);
    b = gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = gg(b, c, d, a, x[i+12], 20, -1926607734);
     
    a = hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = hh(b, c, d, a, x[i+14], 23, -35309556);
    a = hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = hh(d, a, b, c, x[i+12], 11, -421815835);
    c = hh(c, d, a, b, x[i+15], 16,  530742520);
    b = hh(b, c, d, a, x[i+ 2], 23, -995338651);
 
    a = ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i+10], 15, -1051523);
    b = ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = ii(d, a, b, c, x[i+15], 10, -30611744);
    c = ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = ii(b, c, d, a, x[i+ 9], 21, -343485551);
 
    a = add(a, olda);
    b = add(b, oldb);
    c = add(c, oldc);
    d = add(d, oldd);
  }
  if (toHex) {
	return rhex(a) + rhex(b) + rhex(c) + rhex(d);
  } else {
	return a.toString(16) + b.toString(16) + c.toString(16) + d.toString(16);
  }
}