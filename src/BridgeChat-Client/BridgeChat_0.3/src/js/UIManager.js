/* UI Manager
   Description: Handles all interaction with the HTML user interface.
                Holds important user-provided information & aggregates.
*/

// Globals

// Constructor
function UIManager(proto, domain, chatDomain, userAlias) {
	this.proto      = proto;
	this.domain     = domain;
	this.chatDomain = chatDomain;
	this.userAlias  = userAlias;
	this.mainSessionConnected = false;
	this.videoSessionConnected = false;
	// For debug
	document.getElementById("password-box").value = "p4bridgetest";
	
	// -- Startup Tasks --
	// Set Labels depending on protocol
	if(this.proto == "XMPP") {
		$("#user-name .label").text("JID:");
		$("#user-name #domain").text("@" + this.domain);
		$("#password .label").text("Password:");
		$("#chat-nick .label").text("Nick Name:");
	}
	// -- End Startup Tasks --
	
	
	this.onLoginClicked = function() {
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
	}
	
	this.disconnectClicked = function() {
		document.getElementById("username-box").value = this.userName;
		document.getElementById("nickname-box").value = this.chatName;
		document.getElementById("password-box").value = this.userPW;
		document.getElementById("submit-btn").innerHTML = "Connect";
		$("#user-name").show();
		$("#password").show();
		$("#chat-nick").show();
		$("#main-session").hide();
		$("#video-session").hide();
		$("#login-message").text("Disconnected..");
		$("#login-holder").attr('class', 'disconnected');
		this.mainSessionConnected = false;
		this.videoSessionConnected = false;
	}
	
	/*
	*	Displays session UI if it is new, and updates user list to 
	*   match the existing list for each session.
	*/
	this.updateFromSessions = function(chatSessions) {
		console.log("updateFromSessions>>");
		// Clear list
		$("#main-session .user-list").empty();
		if(chatSessions[0]) {
			// Just connected to main session
			$("#main-session").show();
			this.mainSessionConnected = true;
			// Add Us
			var userDiv = "<div class='selfDiv'><i>"+this.chatName+"</i></div>"
			$("#main-session .user-list").append(userDiv);
		}
		if(chatSessions[1]) {
			// Just opened up video session
			$("#video-session").show();
			this.videoSessionConnected = true;
			// Clear List
			$("#video-session .user-list").empty();
			// Add Us
			var userDiv = "<div class='selfDiv'><i>"+this.chatName+"</i></div>"
			$("#video-session .user-list").append(userDiv);
		}
		// Update main room user list
		if(chatSessions[0] && chatSessions[0].users) {
			$.each(chatSessions[0].users, function(userName, user) {
				var userDiv = "<div id='userDiv-"+userName+"' class='userDiv'>"+userName
					+"<button id='userBtn-"+userName+"' class='userBtn' onclick='handleInviteClicked(\""+userName+"\")'>Invite</button></div>";
				$("#main-session .user-list").append(userDiv);
			});
		}
		// Update video room user list
		if(chatSessions[1] && chatSessions[1].users) {
			$.each(chatSessions[1].users, function(userName, user) {
				var userDiv = "<div id='userDiv-"+userName+"' class='userDiv'>"+userName+"</div>";
				$("#video-session .user-list").append(userDiv);
			});
		}
		console.log("updateFromSessions<<");
	}
	
	this.displayInvite = function(fromNick,roomName) {
		console.log("displayInvite>>");
		var inviteBtn = "<button onclick='handleInviteAccepted(\""+roomName+"\")'>Accept</button>"; 
		var inviteDiv = "<div id='inviteMsg-"+fromNick+"' class='message'>" + inviteBtn + "</div>";
		$("#main-session-history").append(inviteDiv);
	}
	
	this.addLocalStream = function(stream) {
		var localVideo = document.getElementById("self-video");
		attachMediaStream(localVideo,stream);
	}
	this.addRemoteStream = function(userName, stream) {
		console.log("addRemoteStream>> "+userName);
		var remoteVideo = '<video id="remote-video-'+userName+'" class="main" autoplay="autoplay">';
		$("#video-window").append(remoteVideo);
		var remoteDiv = document.getElementById("remote-video-"+userName);
		attachMediaStream(remoteDiv,stream);
	}
}