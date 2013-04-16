/*  Main Controller Class
	Description: Handles the high level functionality of the application.
				 Loads all modules and handles all incomming messages / commands from
				 both the UI and the Data layer.
*/

// Global Variables
var dataManager;
var uiManager;
var protoManager;
var chatSessions = {};
var clientId;
var proto = "XMPP"; // 'custom' or 'XMPP' currently supported
var webDomain = "bridgetestchat6";
var chatRoomDomain = "jabber.org";
var alias = "BridgeClient";
var connected = false;
var localStream;
var iceConfig = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
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
	//$(window).unload(function() {
	//	disconnectAllStreams();
	//});
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
		dataManager = new WebsocketManager("192.168.0.103","8888", true);
	} else if(proto == "custom") {
		dataManager = new WebsocketManager("192.168.0.103","8888", false);
	}
	// Init the Data Layer
	dataManager.init(handleMessage, handleDataOpened, handleDataClosed, handleDataError);
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
			// Grab Session ID for User.
			//clientId = $xmlMsg.find("bind").attr("id");
			// Get the user ID for this login.
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
			console.log("onicecandidate>>");
			if(event.candidate) {
				var jsonCandidate = {
					type: 'candidate',
					label: evt.candidate.sdpMLineIndex,
					id: evt.candidate.sdpMid,
					candidate: evt.candidate
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
					stanzaVars['message'] = evt.candidate;
					dataManager.sendMessage(protoManager.util.builder("message",stanzaVars));
				}
			} else if(!event.candidate) {
				// Someone disconnected, get rid of them!
				uiManager.removeRemoteStream(fromNick);
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

function handleVideoDisconnect() {
	
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
			uiManager.onLoginClicked();
			// Send login details
			var stanzaVars = {};
			stanzaVars['nick'] = uiManager.chatName;
			dataManager.sendMessage(protoManager.util.builder("join",stanzaVars));
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
		// Don't connect yet, need user to enter name
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

