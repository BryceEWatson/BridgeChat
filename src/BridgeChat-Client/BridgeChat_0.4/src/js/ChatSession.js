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
		var userDetails = {};
		userDetails["nick"] = chatName;
		this.users[chatName] = userDetails;
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