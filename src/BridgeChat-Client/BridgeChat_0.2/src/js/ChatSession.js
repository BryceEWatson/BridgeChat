
function ChatSession(id,sessionId,userName,roomName,title,connected) {
	this.id = id;
	this.sessionId = sessionId;
	this.roomName = roomName;
	this.title = title;
	this.connected = connected;
	this.available = false;
	this.host = false;
	this.userName = userName;
	this.localStream;
	this.constraints = {"mandatory": {}, "optional": []}; 
	this.pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
	
	this.processPresence = function(msg) {
		msg = "<holder>" + msg + "</holder>";
		var xmlMsgDoc = $.parseXML(msg);
		var $xmlMsg = $(xmlMsgDoc);
		var tmpUserName = "";
		var ourUserName = this.userName;
		var tmpConnected = this.connected;
		var tmpUsers = this.users;
		if(!tmpUsers) {
			// No users yet, create the array
			tmpUsers = {};
		}
		$xmlMsg.find("presence").each(function(index) {
			var details = {};
			var from = $(this).attr("from");
			var to = $(this).attr("to");
			var type = $(this).attr("type");
			console.log("from >> " + from);
			console.log("to >> " + to);
			var tmpUserName = from.split('/')[1];
			
			details["nick"] = tmpUserName;
			//alert("ChatSession>>"+ourUserName);
			if (ourUserName.indexOf(details["nick"]) !== -1) {
				details["self"] = true; // this is us.
				tmpConnected = true;
				ourUserName = details["nick"];
			} else {
				details["self"] = false; // not us.
			}
			if (type && type.indexOf("unavailable") !== -1) {
				// User unavailable, remove from session
				details["available"] = false;
			} else {
				details["available"] = true;
			}
			console.log("tmpUsers >> " + tmpUsers);
			tmpUsers[details["nick"]] = details;
			//this.users["testerOne"] = details;
		});
		this.connected = tmpConnected;
		this.users = tmpUsers;
	}
	
	

	this.createPeerConnection = function(nick) {
		console.log("this.users[nick]>> " + this.users[nick]);
		this.users[nick]["pc"] = new RTCPeerConnection(this.constraints);
		return this.users[nick]["pc"];
	}
	
}

ChatSession.prototype.calculatePlainStanza = function(jid,password) {
	var mainUserName = jid.split("@")[0];
	var userPass = '\0' + mainUserName + '\0' + password;
	var base64UserPass = encode64(userPass);
	var passwordPlainStanza = "<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"+base64UserPass+"</auth>";
	return passwordPlainStanza;
}


