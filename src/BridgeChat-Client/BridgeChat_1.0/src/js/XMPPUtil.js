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