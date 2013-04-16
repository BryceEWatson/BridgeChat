[11:14:47.592] >> recvMsg('<presence from='bridgechatroom@conference.jabber.org/bruce3' to='bridgetest1@jabber.org/chatter299'><x xmlns='http://jabber.org/protocol/muc#user'><item affiliation='owner' role='moderator'/></x></presence><presence from='bridgechatroom@conference.jabber.org/chatter2' to='bridgetest1@jabber.org/chatter299'><x xmlns='http://jabber.org/protocol/muc#user'><item affiliation='owner' role='moderator'/></x></presence><presence from='bridgechatroom@conference.jabber.org/chatter299' to='bridgetest1@jabber.org/chatter299'><x xmlns='http://jabber.org/protocol/muc#user'><item affiliation='owner' role='moderator'/><status code='110'/></x></presence><presence from='bridgechatroom@conference.jabber.org/bruce3' to='bridgetest1@jabber.org/chatter299' type='unavailable'><x xmlns='http://jabber.org/protocol/muc#user'><item affiliation='owner' role='none'/></x></presence><presence from='bridgechatroom@conference.jabber.org/chatter2' to='bridgetest1@jabber.org/chatter299' type='unavailable'><x xmlns='http://jabber.org/protocol/mu')


	
	/*if(msg.indexOf("<iq") !== -1 && msg.indexOf("type='result'") !== -1 && msg.indexOf("<item")) { // Items being returned from disco query
		// Parse each item
		var items = {};
		var i = 0;
		$(msg).find('item').each(function() {
			var itemDetails = {};
			var $item = $(this);
			var jid = $item.find('jid').text();
			var name = $item.find('name').text();
			itemDetails[0] = jid;
			itemDetails[1] = name;
			items[i] = itemDetails;
			i++;
		});
		// Send a detail request for each item
		for(i=0;i<items.length;i++) {
			
		}
	}*/
	
	/*if(msg.indexOf("DIGEST-MD5") !== -1) { // Do DIGEST-MD5 auth, Step 1
		var digestStanza = "<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='DIGEST-MD5'/>"
		console.log(">> Sending: " + digestStanza);
		sendCmd(digestStanza);
	}
	
	if(msg.indexOf("<challenge") !== -1) { // Do DIGEST-MD5 auth, Step 2
		var cnonceVal = "websocket-client";
		var chIndex = msg.indexOf("'>") + 2;
		var chEnd   = msg.indexOf("</");
		var challengeEncoded = msg.substring(chIndex,chEnd);
		var challengeDecoded = decode64("bm9uY2U9Ik90TU5lUklUVXA3cmZUS3Q5RVY2d3k2L0xWWTJTUXFNOFlZQ1poSnAzTTA9IixyZWFsbT0iamFiYmVyLm9yZyIscW9wPSJhdXRoIixtYXhidWY9MTYzODQsY2hhcnNldD11dGYtOCxhbGdvcml0aG09bWQ1LXNlc3M="); // realm="cataclysm.cx",nonce="OA6MG9tEQGm2hh",qop="auth",charset=utf-8,algorithm=md5-sess
		var details = challengeDecoded.split(','); // <name>=<value> pairs
		var pairs = {};
		for (var i=0;i<details.length;i++) {
			var nameValue = details[i].split('=');
			pairs[nameValue[0]] = nameValue[1]; // pairs[<name>] = <value>
			console.log("challengeDecoded>> " + nameValue[0] + "=" + nameValue[1]);
		}
		// Construct Response value
		//1. Create a string of the form "username:realm:password". Call this string X.
		var X = "bridgetest1:jabber.org:p4bridgetest";
		//2. Compute the 16 octet MD5 hash of X. Call the result Y.
		var Y = calcMD5(X,true);
		console.log("Y>> " + Y);
		//3. Create a string of the form "Y:nonce:cnonce:authzid". Call this string A1.
		var A1 = Y + ":" + pairs["nonce"] + ":" + cnonceVal;
		//4. Create a string of the form "AUTHENTICATE:digest-uri". Call this string A2.
		var A2 = "AUTHENTICATE: xmpp/jabber.org";
		//5. Compute the 32 hex digit MD5 hash of A1. Call the result HA1.
		var HA1 = calcMD5(A1,true);
		//6. Compute the 32 hex digit MD5 hash of A2. Call the result HA2.
		var HA2 = calcMD5(A2,true);
		//7. Create a string of the form "HA1:nonce:nc:cnonce:qop:HA2". Call this string KD.
		var KD = HA1 + ':' + pairs["nonce"] + ':00000001:' + cnonceVal + ':auth:' + HA2;
		//8. Compute the 32 hex digit MD5 hash of KD. Call the result Z.
		var Z = calcMD5(KD);
		// Construct Full Response String.. Example: username="rob",realm="cataclysm.cx",nonce="OA6MG9tEQGm2hh",cnonce="OA6MHXh6VqTrRk",nc=00000001,qop=auth,digest-uri="xmpp/cataclysm.cx",response=d388dad90d4bbd760a152321f2143af7,charset=utf-8,authzid="rob@cataclysm.cx/myResource"
		var loginResponse = 'username="bridgetest1",realm="'+pairs["realm"]+'",nonce="'+pairs["nonce"]+'",cnonce="'+cnonceVal+'",nc="00000001",qop="auth",digest-uri="xmpp/jabber.org",response='+Z+'charset="utf-8",authzid="bridgechat1@jabber.org"';
		var responseEncoded = encode64(unescape(loginResponse));
		var responseStanza = '<response xmlns="urn:ietf:params:xml:ns:xmpp-sasl">' + responseEncoded + '</response>';
		console.log("sending>> " + responseStanza);
		sendCmd(responseStanza);
	}*/