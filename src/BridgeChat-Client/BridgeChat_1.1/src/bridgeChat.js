/*  Main Controller Class
	Description: Handles the high level functionality of the application.
				 Loads all modules and handles all incomming messages / commands from
				 both the UI and the Data layer.
*/
// Configuration Variables
var proto = "custom"; // 'custom' or 'XMPP' currently supported
var domain = "192.168.0.103";
var port = "8888";
var webDomain = "bridgetestchat6";
var chatRoomDomain = "jabber.org";

// Global Variables
var dataManager;
var uiManager;
var protoManager;
var chatSessions = {};
var clientId;
var alias = "BridgeClient";
var connected = false;
var localStream;
var iceConfig = {"iceServers": [{"url": "stun:23.21.150.121"}]};
var reconnectCounter = 0;
var reconnectMax     = 5;
var initiator = false;
var webRTCQueue = new Array(); // Execution Queue establishing multiple RTC sessions in order
var sdpQueue = new Array(); // Used by execution queue when providing multiple answers
var xmppVidRoomName;

// Display initial UI
$(document).ready(function() {
	if(proto == "XMPP") {
		uiManager = new UIManager(proto, chatRoomDomain, "conference."+chatRoomDomain, alias);
	} else if(proto == "custom") {
		uiManager = new UIManager(proto);
	}
	uiManager.createInitialUI();
});
// End initial UI

function handleStartClicked() {
	uiManager.createLoginUI();
	startup();
}
function startup() {
	console.log("onStartup>>");
	// Create the Data Manager
	if(proto == "XMPP") {
		dataManager = new WebsocketManager(domain,port, true);
		// Init the Data Layer
		dataManager.init(handleMessage, handleDataOpened, handleDataClosed, handleDataError);
	} else if(proto == "custom") {
		dataManager = new WebsocketManager(domain,port, false);
	}
	// Create Protocol Manager
	protoManager = new Protocol(proto);
	console.log("onStartup<<");
}

function handleMessage(message) {
	console.log("handleMessage >>");
	if(proto == "XMPP") {
		// Bypass regular procedure for XMPP login, as it violates standard XML syntax
		if(message.indexOf("<mechanism>PLAIN</mechanism>") !== -1) {
			// Plain login step 1, send response
			handleLogin(1);
			return;
		} else if(message.indexOf("<bind") !== -1 && message.indexOf("<required/>") !== -1) {
			var index = message.indexOf("id='") + 4;
			var idString = message.substring(index,message.length);
			index = idString.indexOf("'");
			idString = idString.substring(0, index);
			clientId = idString;
			console.log("idString>> " + idString);
			if(!chatSessions[0]) {
				chatSessions[0] = new ChatSession(clientId, webDomain, true);
			}
			// XMPP Binding Required by Server
			handleLogin(3);
			return;
		} else {
			// Parse to XML
			console.log('message: ' + message);
			message = "<holder>" + message + "</holder>";
			var xmlMsgDoc = $.parseXML(message);
			var $xmlMsg = $(xmlMsgDoc);
			if(proto == "XMPP") {
				if ($xmlMsg.has("success").length) {
					console.log("found success element: " + $xmlMsg.has("success").length);
					// Login step 1 completed, send 2nd query
					handleLogin(2);
				} else if ($xmlMsg.has("bind").length && $xmlMsg.has("required").length) { 
					// Moved to bypass due to invalid XML from XMPP
				} else if ($xmlMsg.has("jid").length && $xmlMsg.has("bind").length && $xmlMsg.has("iq").length) {
					// XMPP Binding Complete, Query Main Chat & Connect
					handleLogin(4);
					handleLogin(5);
				} else if ($xmlMsg.has("presence").length) {
					handlePresense(message);
				} else if ($xmlMsg.has("message").length) {
					handleChatMessage(message);
				} else if ($xmlMsg.has("iq").length) {

					if($xmlMsg.has("ping").length) {
						// Send ping response
						var stanzaVars = {};
						stanzaVars['from'] = uiManager.userJID;
						stanzaVars['to'] = protoManager.util.buildRoomJID(webDomain,uiManager.chatDomain,chatRoomDomain);
						stanzaVars['id'] = clientId;
						dataManager.sendMessage(protoManager.util.builder("ping_response",stanzaVars));
					}
				}
			}
		}
	} else if(proto == "custom") {
		console.log("Custom Msg: " +message.data);
		var jsonMsg;
		try {
		  jsonMsg = JSON.parse(message.data);
		} catch (exception) {
		  jsonMsg = null;
		}
		if(jsonMsg) {
			// Check for msg type & process
			if(jsonMsg.type == "join-success") {
				if(!chatSessions[0]) {
					chatSessions[0] = new ChatSession(clientId, webDomain, true);
					chatSessions[1] = new ChatSession(clientId, webDomain, true);
				}
			} else if(jsonMsg.type == "user-list") {
				$.each(jsonMsg.userNames,function(index,name){
					if(name != uiManager.chatName) {
						if(!$("#userDiv-main-"+name).length || $("#userDiv-main-"+name).length == 0) {
							console.log("Adding: " + name);
							chatSessions[0].addUser(name);
							uiManager.displayJoined(name);
						}
					}
				});
				uiManager.updateFromSessions(chatSessions);
			} else if(jsonMsg.type == "user-left") {
				uiManager.displayLeft(jsonMsg.user);
				chatSessions[0].removeUser(jsonMsg.user);
				if(chatSessions[1]) {
					chatSessions[1].removeUser(jsonMsg.user);
					uiManager.removeRemoteStream(jsonMsg.user);
				}
				uiManager.updateFromSessions(chatSessions);
			} else if(jsonMsg.type == "candidate") {
				var fromNick = jsonMsg.from;
				maybeStart(fromNick,false);
				// Set the candidate
				chatSessions[1].users[fromNick]['pc'].addIceCandidate(new RTCIceCandidate(jsonMsg.message));
			} else if(jsonMsg.type == "spd") {
				var fromNick = jsonMsg.from;
				if(!chatSessions[1].users[fromNick]) {
					chatSessions[1].addUser(fromNick);
				}
				if(jsonMsg.message.type == "offer") {
					sdpQueue.push(jsonMsg.message);
					webRTCQueue.push(fromNick+"-notInitiator");
					popRTCQueue();
				} else if (jsonMsg.message.type == "answer") {
					var fromNick = jsonMsg.from;
					chatSessions[1].users[fromNick]['pc'].setRemoteDescription(new RTCSessionDescription(jsonMsg.message));
				}
			} else if(jsonMsg.type === "session-offer") {
				var usersToInvite = jsonMsg.message;
				if(usersToInvite.length == 0) {
					usersToInvite = jsonMsg.from;
				}
				uiManager.displayInvite(jsonMsg.from,usersToInvite);
			}
		}
	}
	console.log("handleMessage<<");
}
/* Processes logic related to leaving / joining a room for both ourselves
   and others.
   Only used for XMPP Protocol.
   */
function handlePresense(message) {
	console.log("handlePresense>>");
	var xmlMsgDoc = $.parseXML(message);
	var $xmlMsg = $(xmlMsgDoc);
	var rtcInitiator = false; // True only on first join
	// There may be multiple presense msgs
	$xmlMsg.find("presence").each(function(index) {
		var fromNick = $.trim($(this).attr("from").split("/")[1]);
		var fromRoom = $(this).attr("from").split("@")[0];
		console.log("fromNick: |" + fromNick + "|, uiManager.chatName: |" + uiManager.chatName+"|");
		console.log(fromNick == uiManager.chatName);
		// Is it an error?
		if(!$(this).has("error").length) {
			if(fromNick == uiManager.chatName) { // Our own status
				console.log("fromRoom: " + fromRoom + ", webdomain: " + webDomain);
				if(fromRoom === webDomain) {
					// Default room
					console.log("type: " + $(this).attr("type"));
					if ($(this).attr("type") && $(this).attr("type") === "unavailable") {
						// We Left Default!
						disconnectAllStreams();
					} else {
						// We Joined Default!
						if(!chatSessions[0]) {
							chatSessions[0] = new ChatSession(clientId, webDomain, true);
						}
						if($(this).has("item").length && $(this).find("item").attr("affiliation") == "owner") {
							// We are the owner of this room, so lets make sure it is unlocked!
							handleLogin(6,fromRoom);
						}
					} 
				} else {
					// Video Chat Room
					if(!$(this).attr("type") || $(this).attr("type") === "available") {
						// Joined New Chat Session
						if(!chatSessions[1]) {
							chatSessions[1] = new ChatSession(clientId, fromRoom, true);
						}
						// Initialize Local Video & Send RTC Offers to all
						rtcInitiator = true; // Might not need this flag?
						// Try to start up our own stream
						if($(this).has("item").length && $(this).find("item").attr("affiliation") == "owner") {
							// We just created this room, so unlock it!
							handleLogin(7,fromRoom);
						}
					}
				}
			} else {// External Peer Status
				// Which Room?
				if(fromRoom === webDomain) {
					// Peer from default room
					if(!$(this).attr("type") || $(this).attr("type") === "available") {
						console.log("chatSessions[0]: " + chatSessions[0]);
						if(!chatSessions[0]) {
							chatSessions[0] = new ChatSession(clientId, webDomain, true);
						}
						if(!$("#userDiv-main-"+name).length || $("#userDiv-main-"+name).length == 0) {
							chatSessions[0].addUser(fromNick);
							uiManager.displayJoined(fromNick);
						}
					} else if($(this).attr("type") === "unavailable") {
						if(chatSessions[0]) {
							chatSessions[0].removeUser(fromNick);
							uiManager.displayLeft(fromNick);
						}
						if(chatSessions[1] && chatSessions[1].users[fromNick]) {
							uiManager.removeRemoteStream(fromNick);
						}
					}
				} else {
					// Could get peer presence before own, so check if its created yet
					if(!chatSessions[1]) {
						chatSessions[1] = new ChatSession(clientId, fromRoom, true);
					}
					// Peer from video chat room
					if(!$(this).attr("type") || $(this).attr("type") === "available") {
						if(!chatSessions[1].users[fromNick]) {
							chatSessions[1].addUser(fromNick);
						}
						// Start local audio/video & Create PeerConnection as initiator
						if(initiator) {
							webRTCQueue.push(fromNick+"-initiator");
						}
					} else if($(this).attr("type") && $(this).attr("type") === "unavailable") {
						chatSessions[1].removeUser(fromNick);
					}
				}
			}
		} else {
			// Handle Error
			if($(this).find("error").attr("code") == "404") {
				// Room not found, try again until timeout
				if(reconnectCounter <= reconnectMax) {
					reconnectCounter = reconnectCounter + 1;
					handleLogin(5);
				}
			}
		}
	});
	popRTCQueue();
	uiManager.updateFromSessions(chatSessions);
	console.log("handlePresense<<");
}

function handleChatMessage(message) {
	var xmlMsgDoc = $.parseXML(message);
	var $xmlMsg = $(xmlMsgDoc);
	var fromNick = $xmlMsg.find("message").attr("from").split("/")[1];
	// There may be multiple messages, grab body of each..
	$xmlMsg.find("body").each(function(index,body) {
		// Is it JSON or Regular msg?
		var jsonMsg;
		try {
		  jsonMsg = JSON.parse($(this).text());
		} catch (exception) {
		  jsonMsg = null;
		}
		if(jsonMsg) {
			console.log("Got JSON Message, type: " + jsonMsg.type);
			// Type of JSON Msg?
			if(jsonMsg.type == "candidate") {
				maybeStart(fromNick,false);
				// Set the candidate
				chatSessions[1].users[fromNick]['pc'].addIceCandidate(new RTCIceCandidate(jsonMsg.candidate));
			} else if(jsonMsg.type == "spd") {
				if(jsonMsg.sdp.type == "offer") {
					initiator = false;
					maybeStart(fromNick,jsonMsg.sdp,false);
				} else if (jsonMsg.sdp.type == "answer") {
					chatSessions[1].users[fromNick]['pc'].setRemoteDescription(new RTCSessionDescription(jsonMsg.sdp));
				}
				
			} else if(jsonMsg.type === "session-offer") {
				uiManager.displayInvite(fromNick, jsonMsg.roomName);
			}
		}
	});
}

function maybeStart(fromNick,remoteSDP,customInitiator) {
	if(!chatSessions[1].users[fromNick]['pc']) {
		chatSessions[1].users[fromNick]['pc'] = new RTCPeerConnection(iceConfig);
		chatSessions[1].users[fromNick]['pc'].onicecandidate = function(event) {
			console.log("onicecandidate>> " + event);
			if(event.candidate) {
				var jsonCandidate = {
					type: 'candidate',
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate
				};
				var stanzaVars = {};
				if(proto == "XMPP") {
					stanzaVars['from'] = uiManager.userJID;
					stanzaVars['to'] = protoManager.util.buildRoomJID(chatSessions[1].roomName,uiManager.chatDomain,fromNick);
					stanzaVars['id'] = clientId;
					stanzaVars['type'] = "chat";
					stanzaVars['msg'] = JSON.stringify(jsonCandidate);
					dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
				} else if(proto == "custom") {
					stanzaVars['type'] = "candidate";
					stanzaVars['from'] = uiManager.chatName;
					stanzaVars['to'] = fromNick;
					stanzaVars['message'] = event.candidate;
					dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
				}
			} else if(!event.candidate) {
				// Someone disconnected, get rid of them!
				//uiManager.removeRemoteStream(fromNick);
				// NULL signal has started to arrive at begining of chat!!
			}
			console.log("onicecandidate<<");
		};
		//chatSessions[1].users[fromNick]['pc'].onSignalingStateChange = function(event) {
		//	var state = chatSessions[1].users[fromNick]['pc'].iceConnectionState;
		//	console.log("oniceconnectionstatechange>> " + state);
		//}
		chatSessions[1].users[fromNick]['pc'].onaddstream = function(event) {
			console.log("onaddstream>>");
			uiManager.addRemoteStream(fromNick, event.stream);
			uiManager.displayNewVideoUser(fromNick);
			popRTCQueue();
			console.log("onaddstream<<");
		};
		chatSessions[1].users[fromNick]['pc'].onremovestream = function(event) {
			console.log("onremovestream>>");
			uiManager.removeRemoteStream(fromNick);
			console.log("onremovestream<<");
		}
	}
	if(!localStream) {
		// No local stream yet, so get it
		getUserMedia({video:true,audio:true}, function(stream) {
			console.log("getUserMedia>>");
			localStream = stream;
			uiManager.addLocalStream(stream);
			addStreamToPC(stream,fromNick,remoteSDP,customInitiator);
		}, function(error) {
			console.log("getUserMedia Error Code: " + errorEntity.code);
		});
	} else {
		// We already have local stream, so add it to the PC
		addStreamToPC(localStream,fromNick,remoteSDP,customInitiator);
	}
}

function addStreamToPC(stream,fromNick,remoteSDP) {

	chatSessions[1].users[fromNick]['pc'].addStream(stream);
	if(initiator) {
		console.log("creating offer");
		chatSessions[1].users[fromNick]['pc'].createOffer(gotDescription);
	} else {
		console.log("creating answer: " + remoteSDP);
		chatSessions[1].users[fromNick]['pc'].setRemoteDescription(new RTCSessionDescription(remoteSDP));
		chatSessions[1].users[fromNick]['pc'].createAnswer(gotDescription);
	}
	console.log("<<getUserMedia");
	function gotDescription(desc) {
		console.log("gotDescription>> type: " + desc.type);
		chatSessions[1].users[fromNick]['pc'].setLocalDescription(desc, function() {
			console.log("setLocalDescription>> " + chatSessions[1].users[fromNick]['pc'].localDescription);
			// Send SPD
			var stanzaVars = {};
			if(proto == "XMPP") {
				var spdJson = {
					type: 'spd',
					sdp: chatSessions[1].users[fromNick]['pc'].localDescription
				};
				stanzaVars['from'] = uiManager.userJID;
				stanzaVars['to'] = protoManager.util.buildRoomJID(chatSessions[1].roomName,uiManager.chatDomain,fromNick);
				stanzaVars['id'] = clientId;
				stanzaVars['type'] = "chat";
				stanzaVars['msg'] = JSON.stringify(spdJson);
				dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
			} else if(proto == "custom") {
				stanzaVars['to'] = fromNick;
				stanzaVars['from'] = uiManager.chatName;
				stanzaVars['type'] = "spd";
				stanzaVars['message'] = chatSessions[1].users[fromNick]['pc'].localDescription;
				dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
			}
			console.log("setLocalDescription<<");
		}, function(error) {
			console.log("setLocalDescription Error: " + error);
		});
		console.log("createOffer<<");
	}
}

function handleMuteClicked(nickName) {
	var videoWindow = document.getElementById("remote-video-"+nickName);
	if(videoWindow.muted) {
		videoWindow.muted = false;
	} else {
		videoWindow.muted = true;
	}
}

function handleInviteClicked(nickName) {
	if(!xmppVidRoomName || xmppVidRoomName.length == 0) {
		var roomName = nickName + Math.floor(Math.random()*9000);
		xmppVidRoomName = roomName;
	} else {
		var roomName = xmppVidRoomName;
	}
	var stanzaVars = {};
	if(proto == "XMPP") {
		stanzaVars['from'] = uiManager.userJID;
		stanzaVars['to'] = protoManager.util.buildRoomJID(roomName,uiManager.chatDomain,uiManager.chatName);
		stanzaVars['id'] = clientId;
		if(!chatSessions[1]) {
			// Join the video chat room
			dataManager.sendMessage(protoManager.util.builder("presense",stanzaVars));
		}
		// Send invite to other user
		var msgJSON = {
			type: 'session-offer',
			roomName: roomName
		};
		stanzaVars['to'] = protoManager.util.buildRoomJID(webDomain,uiManager.chatDomain,nickName);
		stanzaVars['msg'] = JSON.stringify(msgJSON);
		dataManager.sendMessage(protoManager.util.builder("message", stanzaVars));
	} else if(proto == "custom") {
		chatSessions[1].addUser(nickName);
		stanzaVars['to'] = nickName;
		stanzaVars['from'] = uiManager.chatName;
		stanzaVars['type'] = "session-offer";
		stanzaVars['message'] = uiManager.chatName +","+chatSessions[1].getUsersAsString();
		dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
	}
	uiManager.displayInviteSent(nickName);
}

// name: room name for XMPP, user name for custom
function handleInviteAccepted(name) {
	initiator = true;
	// Join the new chat session
	var stanzaVars = {};
	if(proto == "XMPP") {
		stanzaVars['from'] = uiManager.userJID;
		stanzaVars['to'] = protoManager.util.buildRoomJID(name,uiManager.chatDomain,uiManager.chatName);
		stanzaVars['id'] = clientId;
		dataManager.sendMessage(protoManager.util.builder("presense",stanzaVars));
	} else if(proto == "custom") {
		var names = name.split(',');
		if(names && names.length > 0) {
			for(var i=0;i<names.length;i++) {
				if(names[i] != uiManager.chatName) {
					chatSessions[1].addUser(names[i]);
					webRTCQueue.push(names[i]+"-initiator");
				}
			}
		} else {
			chatSessions[1].addUser(name);
			webRTCQueue.push(name+"-initiator");
		}
		popRTCQueue();
	}
}

function popRTCQueue() {
	var i = webRTCQueue.pop();
	if(i) {
		var content = i.split("-");
		if(content[1] == "initiator") {
			initiator = true;
			maybeStart(content[0],true);
		} else {
			initiator = false;
			var sdp = sdpQueue.pop();
			maybeStart(content[0],sdp,false);
		}
	} else {
		initiator = false;
	}
}

function handleLogin(step,room) {
	if(proto == "XMPP") {
		switch(step)
		{
		case 1:
			var password = uiManager.userPW;
			var stanzaVars = {};
			stanzaVars['userName'] = uiManager.userName + "@" + uiManager.domain;
			stanzaVars['password'] = uiManager.userPW;
			dataManager.sendMessage(protoManager.util.builder("plain",stanzaVars));
			return;
		case 2:
			var stanzaVars = {};
			stanzaVars['domain'] = uiManager.domain;
			stanzaVars['stream'] = "http://etherx.jabber.org/streams";
			dataManager.sendMessage(protoManager.util.builder("open_stream",stanzaVars));
			return;
		case 3:
			var stanzaVars = {};
			stanzaVars['bindName'] = alias;
			stanzaVars['bindNum'] = 1;
			dataManager.sendMessage(protoManager.util.builder("bind", stanzaVars));
			return;
		case 4:
			var stanzaVars = {};
			stanzaVars['from'] = uiManager.userJID;
			stanzaVars['to'] = protoManager.util.buildRoomJID(webDomain,uiManager.chatDomain);
			stanzaVars['id'] = clientId;
			dataManager.sendMessage(protoManager.util.builder("disco_get",stanzaVars));
			return;
		case 5:
			var stanzaVars = {};
			stanzaVars['from'] = uiManager.userJID;
			stanzaVars['to'] = protoManager.util.buildRoomJID(webDomain,uiManager.chatDomain,uiManager.chatName);
			stanzaVars['id'] = clientId;
			dataManager.sendMessage(protoManager.util.builder("presense",stanzaVars));
			return;
		case 6:
			var stanzaVars = {};
			stanzaVars['from'] = uiManager.userJID;
			stanzaVars['to'] = protoManager.util.buildRoomJID(webDomain,uiManager.chatDomain);
			dataManager.sendMessage(protoManager.util.builder("instant_room",stanzaVars));
		case 7:
			var stanzaVars = {};
			stanzaVars['from'] = uiManager.userJID;
			stanzaVars['to'] = protoManager.util.buildRoomJID(room,uiManager.chatDomain);
			dataManager.sendMessage(protoManager.util.builder("instant_room",stanzaVars));
		}
	}
}

function handleLoginClicked() {
	if(!connected) {
		connected = true;
		if(proto == "XMPP") {
			dataManager.connectWS();
		} else if(proto == "custom") {
			// Init the Data Layer
			dataManager.init(handleMessage, handleDataOpened, handleDataClosed, handleDataError);
			
		}
	} else if(connected) {
		uiManager.disconnectClicked();
		disconnectAllStreams();
		dataManager.disconnectWS();
		connected = false;
		xmppVidRoomName = "";
	}
}

function handleDataOpened() {
	console.log("handleDataOpened>>");
	var stanzaVars = {};
	if(proto == "XMPP") {
		uiManager.onLoginClicked();
		stanzaVars['domain'] = uiManager.userJID.split('@')[1];
		stanzaVars['stream'] = "http://etherx.jabber.org/streams";
		dataManager.sendMessage(protoManager.util.builder("open_stream",stanzaVars));
	} else if(proto == "custom") {
		uiManager.onLoginClicked();
		// Send login details
		var stanzaVars = {};
		stanzaVars['nick'] = uiManager.chatName;
		dataManager.sendMessage(protoManager.util.builder("join",stanzaVars));
	}
}

function handleDataClosed() {
	disconnectAllStreams();
	console.log("handleDataClosed<<");
}

function handleDataError() {
	disconnectAllStreams();
	console.log("handleDataError<<");
}

function handleVideoDisconnect() {
	disconnectAllStreams();
	uiManager.updateFromSessions(chatSessions);
}

function disconnectAllStreams() {
	// Send disconnect Msgs
	if(proto == "XMPP") {
		$.each(chatSessions, function(index, session) {
			if(proto == "XMPP") {
				// Leave each room
				var stanzaVars = {};
				stanzaVars['from'] = uiManager.userJID;
				stanzaVars['to'] = protoManager.util.buildRoomJID(session.roomName,uiManager.chatDomain,uiManager.chatName);
				stanzaVars['id'] = clientId;
				dataManager.sendMessage(protoManager.util.builder("leave_room",stanzaVars));
			}
			$.each(session.users, function(index, user) {
				// Disconnect each user
				if(user['pc']) {
					user['pc'].close();
					user['pc'] = null;
				}
			});
		});
	} 
	// Kill our own stream
	if(localStream) {
		localStream.stop();
		delete localStream;
	}
	// Clear the sessions
	uiManager.connected = false;
	chatSessions = {};
	if(proto == "XMPP") {
		// Kill the stream
		dataManager.sendMessage(protoManager.util.builder("disconnect"));
	} else if(proto == "custom") {
		var stanzaVars = {};
		stanzaVars['nick'] = uiManager.chatName;
		dataManager.sendMessage(protoManager.util.builder("leave",stanzaVars));
	}
}

/* UI Manager
   Description: Handles all interaction with the HTML user interface.
                Holds important user-provided information & aggregates.
*/

// Globals
var userNameDiv = '<div id="user-name"><div class="label"></div><div class="input"><input id="username-box"></input><div id="domain"></div></div></div>';
var passwordDiv = '<div id="password"><div class="label"></div><div class="input"><input id="password-box"></input></div></div>';
var nicknameDiv = '<div id="chat-nick"><div class="label"></div><div class="input"><input id="nickname-box"></input></div></div>';
var loginBtnDiv = '<div class="submit"><button id="submit-btn" onclick="handleLoginClicked();">Login</button></div>';
// Constructor
function UIManager(proto, domain, chatDomain, userAlias) {
	this.proto      = proto;
	this.domain     = domain;
	this.chatDomain = chatDomain;
	this.userAlias  = userAlias;
	this.mainSessionConnected = false;
	this.videoSessionConnected = false;
	// For debug
	//document.getElementById("password-box").value = "p4bridgetest";
	
	// -- End Startup Tasks --
	
	
	this.onLoginClicked = function() {
		if(this.proto == "XMPP") {
			this.userName = document.getElementById("username-box").value;
			this.chatName = document.getElementById("nickname-box").value;
			this.userPW   = document.getElementById("password-box").value;
			this.userJID  = this.userName + "@" + this.domain + "/" + userAlias;
			
			// Change login btn to disconnect
			document.getElementById("submit-btn").innerHTML = "Disconnect";
			// Hide login panels
			$("#user-name").hide();
			$("#password").hide();
			$("#chat-nick").hide();
			// Display Info
			$("#login-message").text("User Name: " + this.userName + ", Chat Nick: " + this.chatName);
			$("#login-holder").attr('class', 'connected');
		} else if(this.proto == "custom") {
			this.chatName = document.getElementById("nickname-box").value;
			// Change login btn to disconnect
			document.getElementById("submit-btn").innerHTML = "Disconnect";
			$("#chat-nick").hide();
			$("#login-message").text("Chat Nick: " + this.chatName);
			$("#login-holder").attr('class', 'connected');
		}
	}
	
	this.disconnectClicked = function() {
		this.mainSessionConnected = false;
		document.getElementById("submit-btn").innerHTML = "Connect";
		document.getElementById("nickname-box").value = this.chatName;
		if(this.proto == "XMPP") {
			document.getElementById("username-box").value = this.userName;
			document.getElementById("password-box").value = this.userPW;
			$("#user-name").show();
			$("#password").show();
			$("#chat-nick").show();
			$("#main-session").hide();
			$("#video-session").hide();
			$("#login-message").text("Disconnected..");
			$("#login-holder").attr('class', 'disconnected');
			this.mainSessionConnected = false;
			this.videoSessionConnected = false;
		} else if(this.proto == "custom") {
			
			$("#chat-nick").show();
			$("#main-session").hide();
			$("#video-session").hide();
			$("#login-message").text("Disconnected..");
			$("#login-holder").attr('class', 'disconnected');
			this.mainSessionConnected = false;
			this.videoSessionConnected = false;
		}
	}
	
	/*
	*	Displays session UI if it is new, and updates user list to 
	*   match the existing list for each session.
	*/
	this.updateFromSessions = function(chatSessions) {
		console.log("updateFromSessions>>");
		// Update main room user list
		if(chatSessions[0] && chatSessions[0].users) {
			
			if(!chatSessions[0].users.length && !this.mainSessionConnected) {
				// Just connected to main session
				this.createMainSessionUI();
				this.mainSessionConnected = true;
				this.displayJoined(this.chatName);
			}
			// Clear list
			$("#main-session .user-list").empty();
			// Add Us
			var userDiv = "<div class='selfDiv'><i>"+this.chatName+"</i></div>"
			$("#main-session .user-list").append(userDiv);
			
			$.each(chatSessions[0].users, function(userName, user) {
				var userDiv = "<div id='userDiv-main-"+userName+"' class='userDiv'>"+userName
					+"<button id='userBtn-"+userName+"' class='userBtn' onclick='handleInviteClicked(\""+userName+"\")'>Invite</button></div>";
				$("#main-session .user-list").append(userDiv);
			});
		}
		// Update video room user list
		if(chatSessions[1] && chatSessions[1].users) {
			// Clear List
			$(".chat-users").empty();
			this.videoSessionConnected = true;
			// Add Us
			var userDiv = "<div class='selfDiv'><i>"+this.chatName+"</i></div>"
			$(".chat-users").append(userDiv);
			
			$.each(chatSessions[1].users, function(userName, user) {
				var userDiv = "<div id='userDiv-video-"+userName+"' class='userDiv'>"+userName+"<button id='muteBtn-"+userName+"' onclick='handleMuteClicked(\""+userName+"\")'>Mute</button></div>";
				$(".chat-users").append(userDiv);
			});
		}
		console.log("updateFromSessions<<");
	}
	
	this.createInitialUI = function() {
		console.log("createInitialUI>>");
		$("#bridgechat-container").append('<div id="initial-holder"></div>');
		$("#initial-holder").append('<div id="init-btn-holder"><button id="start-btn" onclick="handleStartClicked();">Start Video Chat</button></div>');
	}
	
	this.createLoginUI = function() {
		$("#initial-holder").hide();
		$("#bridgechat-container").append('<div id="login-holder" class="disconnected"></div>');
		$("#bridgechat-container").append('<div id="login-message"></div>');
		if(this.proto == "XMPP") {
			$("#login-holder").append(userNameDiv);
			$("#login-holder").append(passwordDiv);
			$("#login-holder").append(nicknameDiv);
			
			$("#user-name .label").text("JID:");
			$("#user-name #domain").text("@" + this.domain);
			$("#password .label").text("Password:");
			$("#chat-nick .label").text("Nick Name:");
		} else if(this.proto == "custom") {
			$("#login-holder").append(nicknameDiv);
			$("#chat-nick .label").text("Nick Name:");
		}
		$("#login-holder").append(loginBtnDiv);
	}
	
	this.createMainSessionUI = function() {
		if(!$("#main-session").length) {
			$("#bridgechat-container").append('<div id="main-session" class="session-holder"></div>');
			$("#main-session").append('<div id="main-session-history" class="history-window"></div><div id="users-container"><b>User List</b><div class="user-list"></div><b>Chat Participants</b><div class="chat-users"></div></div>');
		} else {
			$("#main-session").show();
		}
		$("#main-session-history").empty();
	}
	
	this.createVideoSessionUI = function() {
		
		$("#bridgechat-container").append('<div id="video-session" class="session-holder"></div>');
		$("#video-session").append('<div class="title">Video Session</div><div id="video-window"><video id="self-video" class="main" autoplay="autoplay"></div><div class="user-list"></div>');
	}
	
	this.displayInvite = function(fromNick,roomName) {
		console.log("displayInvite>>");
		if(this.proto == "XMPP") {
			var inviteBtn = "<div class='msg'>Invite to chat from <i>"+fromNick+"</i> <button onclick='handleInviteAccepted(\""+roomName+"\")'>Accept</button></div>"; 
		} else if(this.proto == "custom") {
			var inviteBtn = "<div class='msg'>Invite to chat from <i>"+fromNick+"</i> <button onclick='handleInviteAccepted(\""+roomName+"\")'>Accept</button></div>"; 
		}
		//var inviteDiv = "<div id='inviteMsg-"+fromNick+"' class='message'>" + inviteBtn + "</div>";
		$("#main-session-history").append(inviteBtn);
	}
	
	this.displayInviteSent = function(toNick) {
		var msgDiv = "<div class='msg'>Video Chat invite sent to <i>"+toNick+"</i></div>";
		$("#main-session-history").append(msgDiv);
	}
	
	this.displayJoined = function(joinedNick) {
		var msgDiv = "<div class='msg'><i>"+joinedNick+"</i> joined main chat</div>";
		$("#main-session-history").append(msgDiv);
	}
	
	this.displayVideoJoined = function(joinedNick) {
		var msgDiv = "<div class='msg'><i>"+joinedNick+"</i> joined video chat</div>";
		$("#main-session-history").append(msgDiv);
	}
	
	this.displayLeft = function(leftNick) {
		var msgDiv = "<div class='msg'><i>"+leftNick+"</i> left main chat</div>";
		$("#main-session-history").append(msgDiv);
	}
	
	this.displayNewVideoUser = function(newUser) {
		var userDiv = "<div id='userDiv-video-"+newUser+"' class='userDiv'>"+newUser+"<button id='muteBtn-"+newUser+"' onclick='handleMuteClicked(\""+newUser+"\")'>Mute</button></div>";
		$(".chat-users").append(userDiv);
		// Hide invite btn from main chat
		$("#userBtn-"+newUser).hide();
		$("#userDiv-main-"+newUser).css("text-decoration","underline");
	}
	
	this.addLocalStream = function(stream) {
		$("#main-session-history").hide();
		//$("#users-container").append('<div id="video-session-btnHolder"><button id="video-session-btn" onclick="handleVideoDisconnect();">Leave Video Chat</button></div>');
		$("#main-session").append('<div id="video-session"></div>');
		$("#video-session").append('<video id="self-video" autoplay="autoplay"></video>');
		var localVideo = document.getElementById("self-video");
		attachMediaStream(localVideo,stream);
		localVideo.muted = true;
	}
	
	this.removeRemoteStream = function(userName) {
		delete($("#remote-video-"+userName));
		$("#remote-video-"+userName).remove();
		
		var numLeft = $(".remote-vid").length;
		if(numLeft == 0) {
			$("#self-video").height(500);
			$("#self-video").css("position","");
		} else if(numLeft == 1) {
			
		}
	}
	
	this.hideVideoSession = function(){
		$("#video-session").hide();
		$("#main-session-history").show();
	}
	
	this.addRemoteStream = function(userName, stream) {
		console.log("addRemoteStream>> "+userName);
		var classNum = "";
		var numVids = $('.remote-vid').length;
		if(numVids == 0) {
			// First time, shrink self vid
			$("#self-video").height(100);
			$("#self-video").css("bottom","0");
			$("#self-video").css("right","0");
			$("#self-video").css("z-index","100");
			$("#self-video").css("position","absolute");
			classNum = "oneOther";
		} else if(numVids == 1) {
			// Shrink existing external video before adding new one
			$(".remote-vid").removeClass("oneOther");
			$(".remote-vid").removeClass("threeOthers");
			$(".remote-vid").addClass("twoOthers");
			classNum = "twoOthers";
		} else if(numVids == 2) {
			$(".remote-vid").removeClass("oneOther");
			$(".remote-vid").removeClass("twoOthers");
			$(".remote-vid").addClass("threeOthers");
			classNum = "threeOthers";
		}
		var remoteVideo = '<video id="remote-video-'+userName+'" class="remote-vid '+classNum+'" autoplay="autoplay">';
		$("#video-session").append(remoteVideo);
		var remoteDiv = document.getElementById("remote-video-"+userName);
		attachMediaStream(remoteDiv,stream);
	}
}

/* Chat Session Data Holder
   Description: Holds essential chat information for each session.
                There may be one or more of these collections depending on how many
				chat sessions are open. (Currently only 2 sessions supported).
*/

// Constructor
function ChatSession(sessionId, roomName, connected) {
	this.sessionId = sessionId;
	this.roomName  = roomName;
	this.connected = connected;
	this.users = {};
	
	this.addUser = function(chatName) {
		chatNameEncoded = chatName;
		var userDetails = {};
		userDetails["nick"] = chatNameEncoded;
		this.users[chatNameEncoded] = userDetails;
	}
	
	this.removeUser = function(chatName) {
		if(this.users[chatName]) {
			delete this.users[chatName];
		}
	}
	
	this.getUsersAsString = function() {
		var names = "";
		var first = true;
		for(var i in this.users) {
			if(!first) {
				names += ",";
			}
			names += this.users[i]["nick"];
			first = false;
		}
		return names;
	}
}

/* Protocol Abstraction Class
   Description: Allows the Controller to easily change between protocols.
*/
// Global Vars

// Constructor
function Protocol(type) {
	this.type = type;
	if(type == "XMPP") {
		this.util = new XMPPUtil();
	} else if(type == "custom") {
		this.util = new CustomUtil();
	}
	
}

/* Custom Utilities Class
   Description: Provides custom protocol functionality to the application
*/

// Constructor
function CustomUtil() {

	this.builder = function(type,stanzaVars) {
		console.log("builder>> " + type);
		switch (type)
		{
			case "join":
				json = {
					type: type,
					nick: stanzaVars['nick']
				};
				return JSON.stringify(json);
			case "leave":
				json = {
					type: type,
					nick: stanzaVars['nick']
				};
				return JSON.stringify(json);
			case "message":
				json = {
					type: stanzaVars['type'],
					to: stanzaVars['to'],
					from: stanzaVars['from'],
					message: stanzaVars['message']
				};
				return JSON.stringify(json);
		}
	}
	
}

/* XMPP Utilities Class
   Description: Provides XMPP-specific protocol functionality to the application
*/

// Constructor
function XMPPUtil() {

	this.builder = function(type,stanzaVars) {
		console.log("builder>> " + type);
		switch (type)
		{
			case "open_stream":
				return '<?xml version="1.0"?>\n\n<stream:stream xmlns:stream="'+stanzaVars['stream']+'" version="1.0" xmlns="jabber:client" to="'+stanzaVars['domain']+'" xml:lang="en" xmlns:xml="http://www.w3.org/XML/1998/namespace">';
			case "plain":
				var mainUserName = stanzaVars['userName'];
				var userPass = '\0' + mainUserName + '\0' + stanzaVars['password'];
				var base64UserPass = encode64(userPass);
				console.log("plain login>> " + userPass);
				return "<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"+base64UserPass+"</auth>";
			case "bind":
				return '<iq type="set" id="bind_'+stanzaVars['bindNum']+'"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>'+stanzaVars['bindName']+'</resource></bind></iq>'; 
			case "instant_room":
				return "<iq from='"+stanzaVars['from']+"' id='create1' to='"+stanzaVars['to']+"' type='set'> <query xmlns='http://jabber.org/protocol/muc#owner'> <x xmlns='jabber:x:data' type='submit'/></query></iq>";
			case "presense":
				return "<presence from='"+stanzaVars['from']+"' id='"+stanzaVars['id']+"' to='"+stanzaVars['to']+"'><x xmlns='http://jabber.org/protocol/muc'/></presence>";
			case "message":
				return "<message from='"+stanzaVars['from']+"' id='"+stanzaVars['id']+"' to='"+stanzaVars['to']+"' type='chat'><body>"+stanzaVars['msg']+"</body></message>";
			case "leave_room":
				return "<presence from='"+stanzaVars['from']+"' id='"+stanzaVars['id']+"' to='"+stanzaVars['to']+"' type='unavailable'></presence>";
			case "disconnect":
				return "</stream:stream>";
			case "disco_get":
				return "<iq from='"+stanzaVars['from']+"' id='"+stanzaVars['id']+"' to='"+stanzaVars['to']+"' type='get'> <query xmlns='http://jabber.org/protocol/disco#info'/> </iq>";
			case "ping_response":
				return "<iq from='"+stanzaVars['from']+"' to='"+stanzaVars['to']+"' id='"+stanzaVars['id']+"' type='result'/>";
			default:
				return false;
		}
	}
	
	this.buildRoomJID = function(roomName, chatDomain, chatName) {
		if(!chatName) {
			return roomName + "@" + chatDomain;
		} else {
			return roomName + "@" + chatDomain + "/" + chatName;
		}
	}
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
				ws = new WebSocket("ws://"+this.host+":"+this.port);
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

/*
* Websock: high-performance binary WebSockets
* Copyright (C) 2012 Joel Martin
* Licensed under MPL 2.0 (see LICENSE.txt)
*
* Websock is similar to the standard WebSocket object but Websock
* enables communication with raw TCP sockets (i.e. the binary stream)
* via websockify. This is accomplished by base64 encoding the data
* stream between Websock and websockify.
*
* Websock has built-in receive queue buffering; the message event
* does not contain actual data but is simply a notification that
* there is new data available. Several rQ* methods are available to
* read binary data off of the receive queue.
*/

if (window.WebSocket && !window.WEB_SOCKET_FORCE_FLASH) {
    Websock_native = true;
} else if (window.MozWebSocket && !window.WEB_SOCKET_FORCE_FLASH) {
    Websock_native = true;
    window.WebSocket = window.MozWebSocket;
} else {
    /* no builtin WebSocket so load web_socket.js */

    Websock_native = false;
    (function () {
        window.WEB_SOCKET_SWF_LOCATION = Util.get_include_uri() +
                    "web-socket-js/WebSocketMain.swf";
        if (Util.Engine.trident) {
            console.log("Forcing uncached load of WebSocketMain.swf");
            window.WEB_SOCKET_SWF_LOCATION += "?" + Math.random();
        }
        Util.load_scripts(["web-socket-js/swfobject.js",
                           "web-socket-js/web_socket.js"]);
    }());
}


function Websock() {
"use strict";

var api = {}, // Public API
    websocket = null, // WebSocket object
    mode = 'base64', // Current WebSocket mode: 'binary', 'base64'
    rQ = [], // Receive queue
    rQi = 0, // Receive queue index
    rQmax = 100000, // Max receive queue size before compacting
    sQ = [], // Send queue

    eventHandlers = {
        'message' : function() {},
        'open' : function() {},
        'close' : function() {},
        'error' : function() {}
    },

    test_mode = false;


//
// Queue public functions
//

function get_sQ() {
    return sQ;
}

function get_rQ() {
    return rQ;
}
function get_rQi() {
    return rQi;
}
function set_rQi(val) {
    rQi = val;
}

function rQlen() {
    return rQ.length - rQi;
}

function rQpeek8() {
    return (rQ[rQi] );
}
function rQshift8() {
    return (rQ[rQi++] );
}
function rQunshift8(num) {
    if (rQi === 0) {
        rQ.unshift(num);
    } else {
        rQi -= 1;
        rQ[rQi] = num;
    }

}
function rQshift16() {
    return (rQ[rQi++] << 8) +
           (rQ[rQi++] );
}
function rQshift32() {
    return (rQ[rQi++] << 24) +
           (rQ[rQi++] << 16) +
           (rQ[rQi++] << 8) +
           (rQ[rQi++] );
}
function rQshiftStr(len) {
    if (typeof(len) === 'undefined') { len = rQlen(); }
    var arr = rQ.slice(rQi, rQi + len);
    rQi += len;
    return String.fromCharCode.apply(null, arr);
}
function rQshiftBytes(len) {
    if (typeof(len) === 'undefined') { len = rQlen(); }
    rQi += len;
    return rQ.slice(rQi-len, rQi);
}

function rQslice(start, end) {
    if (end) {
        return rQ.slice(rQi + start, rQi + end);
    } else {
        return rQ.slice(rQi + start);
    }
}

// Check to see if we must wait for 'num' bytes (default to FBU.bytes)
// to be available in the receive queue. Return true if we need to
// wait (and possibly print a debug message), otherwise false.
function rQwait(msg, num, goback) {
    var rQlen = rQ.length - rQi; // Skip rQlen() function call
    if (rQlen < num) {
        if (goback) {
            if (rQi < goback) {
                throw("rQwait cannot backup " + goback + " bytes");
            }
            rQi -= goback;
        }
        //console.log(" waiting for " + (num-rQlen) +
        // " " + msg + " byte(s)");
        return true; // true means need more data
    }
    return false;
}

//
// Private utility routines
//

function encode_message() {
    if (mode === 'binary') {
        // Put in a binary arraybuffer
        return (new Uint8Array(sQ)).buffer;
    } else {
        // base64 encode
		//console.log(">> encode_message: " + Base64.encode(sQ));
        return Base64.encode(sQ);
    }
}

function decode_message(data) {
    //console.log(">> decode_message: " + data);
    if (mode === 'binary') {
        // push arraybuffer values onto the end
        var u8 = new Uint8Array(data);
        for (var i = 0; i < u8.length; i++) {
            rQ.push(u8[i]);
        }
    } else {
        // base64 decode and concat to the end
        rQ = rQ.concat(Base64.decode(data, 0));
    }
    //console.log(">> decode_message, rQ: " + rQ);
}


//
// Public Send functions
//

function flush() {
    if (websocket.bufferedAmount !== 0) {
        console.log("bufferedAmount: " + websocket.bufferedAmount);
    }
    if (websocket.bufferedAmount < api.maxBufferedAmount) {
        //console.log("arr: " + arr);
        //console.log("sQ: " + sQ);
        if (sQ.length > 0) {
            websocket.send(encode_message(sQ));
            sQ = [];
        }
        return true;
    } else {
        console.log("Delaying send, bufferedAmount: " +
                websocket.bufferedAmount);
        return false;
    }
}

// overridable for testing
function send(arr) {
    //console.log(">> send_array: " + arr);
    sQ = sQ.concat(arr);
    return flush();
}

function send_string(str) {
    //console.log(">> send_string: " + str);
    api.send(str.split('').map(
        function (chr) { return chr.charCodeAt(0); } ) );
}

//
// Other public functions

function recv_message(e) {
    //console.log(">> recv_message length: " + e.data.length);

    
        decode_message(e.data);
        if (rQlen() > 0) {
            eventHandlers.message();
            // Compact the receive queue
            if (rQ.length > rQmax) {
                //console.log("Compacting receive queue");
                rQ = rQ.slice(rQi);
                rQi = 0;
            }
        } else {
            console.log("Ignoring empty message");
        }
    
    //console.log("<< recv_message");
}


// Set event handlers
function on(evt, handler) {
    eventHandlers[evt] = handler;
}

function init(protocols) {
    rQ = [];
    rQi = 0;
    sQ = [];
    websocket = null;

    var bt = false,
        wsbt = false,
        try_binary = false;

    // Check for full typed array support
    if (('Uint8Array' in window) &&
        ('set' in Uint8Array.prototype)) {
        bt = true;
    }

    // Check for full binary type support in WebSockets
    // TODO: this sucks, the property should exist on the prototype
    // but it does not.
    try {
        if (bt && ('binaryType' in (new WebSocket("ws://localhost:17523")))) {
            console.log("Detected binaryType support in WebSockets");
            wsbt = true;
        }
    } catch (exc) {
        // Just ignore failed test localhost connections
    }

    // Default protocols if not specified
    if (typeof(protocols) === "undefined") {
        if (wsbt) {
            protocols = ['binary', 'base64'];
        } else {
            protocols = 'base64';
        }
    }

    // If no binary support, make sure it was not requested
    if (!wsbt) {
        if (protocols === 'binary') {
            throw("WebSocket binary sub-protocol requested but not supported");
        }
        if (typeof(protocols) === "object") {
            var new_protocols = [];
            for (var i = 0; i < protocols.length; i++) {
                if (protocols[i] === 'binary') {
                    Util.Error("Skipping unsupported WebSocket binary sub-protocol");
                } else {
                    new_protocols.push(protocols[i]);
                }
            }
            if (new_protocols.length > 0) {
                protocols = new_protocols;
            } else {
                throw("Only WebSocket binary sub-protocol was requested and not supported.");
            }
        }
    }

    return protocols;
}

function open(uri, protocols) {
    protocols = init(protocols);

    if (test_mode) {
        websocket = {};
    } else {
        websocket = new WebSocket(uri, protocols);
        if (protocols.indexOf('binary') >= 0) {
            websocket.binaryType = 'arraybuffer';
        }
    }

    websocket.onmessage = recv_message;
    websocket.onopen = function() {
        console.log(">> WebSock.onopen");
        if (websocket.protocol) {
            mode = websocket.protocol;
            console.log("Server chose sub-protocol: " + websocket.protocol);
        } else {
            mode = 'base64';
            Util.Error("Server select no sub-protocol!: " + websocket.protocol);
        }
        eventHandlers.open();
        console.log("<< WebSock.onopen");
    };
    websocket.onclose = function(e) {
        console.log(">> WebSock.onclose");
        eventHandlers.close(e);
        console.log("<< WebSock.onclose");
    };
    websocket.onerror = function(e) {
        console.log(">> WebSock.onerror: " + e);
        eventHandlers.error(e);
        console.log("<< WebSock.onerror");
    };
}

function close() {
    if (websocket) {
        if ((websocket.readyState === WebSocket.OPEN) ||
            (websocket.readyState === WebSocket.CONNECTING)) {
            console.log("Closing WebSocket connection");
            websocket.close();
        }
        websocket.onmessage = function (e) { return; };
    }
}

// Override internal functions for testing
// Takes a send function, returns reference to recv function
function testMode(override_send, data_mode) {
    test_mode = true;
    mode = data_mode;
    api.send = override_send;
    api.close = function () {};
    return recv_message;
}

function constructor() {
    // Configuration settings
    api.maxBufferedAmount = 80000;

    // Direct access to send and receive queues
    api.get_sQ = get_sQ;
    api.get_rQ = get_rQ;
    api.get_rQi = get_rQi;
    api.set_rQi = set_rQi;

    // Routines to read from the receive queue
    api.rQlen = rQlen;
    api.rQpeek8 = rQpeek8;
    api.rQshift8 = rQshift8;
    api.rQunshift8 = rQunshift8;
    api.rQshift16 = rQshift16;
    api.rQshift32 = rQshift32;
    api.rQshiftStr = rQshiftStr;
    api.rQshiftBytes = rQshiftBytes;
    api.rQslice = rQslice;
    api.rQwait = rQwait;

    api.flush = flush;
    api.send = send;
    api.send_string = send_string;

    api.on = on;
    api.init = init;
    api.open = open;
    api.close = close;
    api.testMode = testMode;

    return api;
}

return constructor();

}
/* General Utilities Class
   Description: Provides untility functions such as Base64 Encoding,
                Cross-Browser support, etc.
				Note: No constructor b/c we want global var access.
*/

// --- WebRTC Compatability Start ---
var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;

if (navigator.mozGetUserMedia) {
  console.log("This appears to be Firefox");
  // The RTCPeerConnection object.
  RTCPeerConnection = mozRTCPeerConnection;
  RTCSessionDescription = mozRTCSessionDescription;
  getUserMedia = navigator.mozGetUserMedia.bind(navigator);
  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    console.log("Attaching media stream");
    element.mozSrcObject = stream;
    element.play();
  };
} else if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
  // The RTCPeerConnection object.
  RTCPeerConnection = webkitRTCPeerConnection;
  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    element.src = webkitURL.createObjectURL(stream);
  };
} else {
  console.log("Browser does not appear to be WebRTC-capable");
}
// --- WebRTC Compatability End ---

// --- Base64 Functionality Start ---
var Base64 = {
	/* Convert data (an array of integers) to a Base64 string. */
	toBase64Table : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split(''),
	base64Pad : '=',
	encode: function (data) {
		"use strict";
		var result = '';
		var toBase64Table = Base64.toBase64Table;
		var base64Pad = Base64.base64Pad;
		var length = data.length;
		var i;
		// Convert every three bytes to 4 ascii characters.
	  /* BEGIN LOOP */
		for (i = 0; i < (length - 2); i += 3) {
			result += toBase64Table[data[i] >> 2];
			result += toBase64Table[((data[i] & 0x03) << 4) + (data[i+1] >> 4)];
			result += toBase64Table[((data[i+1] & 0x0f) << 2) + (data[i+2] >> 6)];
			result += toBase64Table[data[i+2] & 0x3f];
		}
	  /* END LOOP */
		// Convert the remaining 1 or 2 bytes, pad out to 4 characters.
		if (length%3) {
			i = length - (length%3);
			result += toBase64Table[data[i] >> 2];
			if ((length%3) === 2) {
				result += toBase64Table[((data[i] & 0x03) << 4) + (data[i+1] >> 4)];
				result += toBase64Table[(data[i+1] & 0x0f) << 2];
				result += base64Pad;
			} else {
				result += toBase64Table[(data[i] & 0x03) << 4];
				result += base64Pad + base64Pad;
			}
		}
		return result;
	},
	/* Convert Base64 data to a string */
	toBinaryTable : [
		-1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
		-1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
		-1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,62, -1,-1,-1,63,
		52,53,54,55, 56,57,58,59, 60,61,-1,-1, -1, 0,-1,-1,
		-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11,12,13,14,
		15,16,17,18, 19,20,21,22, 23,24,25,-1, -1,-1,-1,-1,
		-1,26,27,28, 29,30,31,32, 33,34,35,36, 37,38,39,40,
		41,42,43,44, 45,46,47,48, 49,50,51,-1, -1,-1,-1,-1
	],
	decode: function (data, offset) {
		"use strict";
		offset = typeof(offset) !== 'undefined' ? offset : 0;
		var toBinaryTable = Base64.toBinaryTable;
		var base64Pad = Base64.base64Pad;
		var result, result_length, idx, i, c, padding;
		var leftbits = 0; // number of bits decoded, but yet to be appended
		var leftdata = 0; // bits decoded, but yet to be appended
		var data_length = data.indexOf('=') - offset;
		if (data_length < 0) { data_length = data.length - offset; }
		/* Every four characters is 3 resulting numbers */
		result_length = (data_length >> 2) * 3 + Math.floor((data_length%4)/1.5);
		result = new Array(result_length);
		// Convert one by one.
	  /* BEGIN LOOP */
		for (idx = 0, i = offset; i < data.length; i++) {
			c = toBinaryTable[data.charCodeAt(i) & 0x7f];
			padding = (data.charAt(i) === base64Pad);
			// Skip illegal characters and whitespace
			if (c === -1) {
				console.log("Illegal character code " + data.charCodeAt(i) + " at position " + i);
				continue;
			}
			// Collect data into leftdata, update bitcount
			leftdata = (leftdata << 6) | c;
			leftbits += 6;
			// If we have 8 or more bits, append 8 bits to the result
			if (leftbits >= 8) {
				leftbits -= 8;
				// Append if not padding.
				if (!padding) {
					result[idx++] = (leftdata >> leftbits) & 0xff;
				}
				leftdata &= (1 << leftbits) - 1;
			}
		}
	  /* END LOOP */
		// If there are any bits left, the base64 string was corrupted
		if (leftbits) {
			throw {name: 'Base64-Error',
				   message: 'Corrupted base64 string'};
		}
		return result;
	}
};
// --- Base64 Functionality End ---