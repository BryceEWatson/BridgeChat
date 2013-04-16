
function WebRTCManager(localVideo,remoteVideos) {
	this.localVideo = localVideo;
	this.localStream = "";
	this.remoteVideos = remoteVideos;
	this.remoteStreams = {};
	this.constraints = {"mandatory": {}, "optional": []}; 
	this.pc = "";
	this.pc_config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
	
	this.initialize = function() {
		console.log("Initializing WebRTCManager");
		// 1. Get user's stream
		try {
			getUserMedia({'audio':true,'video':constraints},this.onUserMediaSuccess,this.onUserMediaError);
		} catch (e) {
			alert("getUserMedia() failed. Is this a WebRTC capable browser?");
			console.log("getUserMedia failed with exception: " + e.message);
		}
		// 2. Create Peer Connection
		try {
			this.pc = new RTCPeerConnection(this.pc_config);
			this.pc.onicecandidate = this.onIceCandidate;
			console.log("Created RTCPeerConnnection with config:\n" + "  \"" +
			JSON.stringify(this.pc_config) + "\".");
		} catch (e) {
			console.log("Failed to create PeerConnection, exception: " + e.message);
			alert("Cannot create RTCPeerConnection object; WebRTC is not supported by this browser.");
			return;
		}
		// Bindings
		this.pc.onconnecting = this.onSessionConnecting;
	    this.pc.onopen = this.onSessionOpened;
	    this.pc.onaddstream = this.onRemoteStreamAdded;
	    this.pc.onremovestream = this.onRemoteStreamRemoved;
	}
	
	this.onRemoteStreamAdded = function(event) {
	    remoteStreams[0] = event.stream;
		remoteVideos[0].src = URL.createObjectURL(event.stream);
	    this.waitForRemoteVideo();
	}
	this.onSessionConnecting = function() {console.log("Session Connecting..");}
	this.onSessionOpened = function() {console.log("Session Opened..");}
	this.onRemoteStreamRemoved = function() {console.log("Remote Stream Removed..");}
	
	this.waitForRemoteVideo = function() {
		videoTracks = remoteStream.getVideoTracks();
		if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
			// Video started! Do some UI stuff here?
		} else {
			// No video yet, keep waiting
			console.log("Waiting for video...");
			setTimeout(this.waitForRemoteVideo, 100);
		}
	}
	
	this.onUserMediaSuccess = function(stream) {
		console.log("User has granted access to local media.");
		// Bind stream to local video
		this.localVideo.src = URL.createObjectURL(stream);
		this.localStream = stream;
	}
	
	this.onUserMediaError = function() {
		console.log("Failed to get access to local media. Error code was " + error.code);
		alert("Failed to get access to local media. Error code was " + error.code + ".");
	}
}