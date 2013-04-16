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
		$("#users-container").append('<div id="video-session-btnHolder"><button id="video-session-btn" onclick="handleVideoDisconnect();">Leave Video Chat</button></div>');
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