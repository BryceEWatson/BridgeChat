var ws, sQ = [],
    state = "unconnected";
var host = "jabber.org";
var userName = ""; // Ex. bridgetest1
var jid = ""; // Your website's user account
var password = "p4bridgetest";
var bridgeClient = "BridgeClient";
var chatRoomName = "bridgetestchat";
var chatNick = "";
var disconnectStanza = "<presence type='unavailable'><status>Logged out</status></presence>";
var streamStanza = "<?xml version='1.0'?>  <stream:stream to='jabber.org' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' xmlns:tls='http://www.ietf.org/rfc/rfc25295.txt' version='1.0'>";
//var resourceBindingStanza = '<iq type="set" id="bind_1"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>'+clientName+'</resource></bind></iq>';
var clientUser = ""; // example: bridgetest1@jabber.org/BridgeClient
var clientID = "";
var doPlainLogin = true;
var users = {};

window.onload=function(){
	// Set the domain label
	document.getElementById("domainLbl").innerHTML = "<i>@"+host+"</i>";
}
	
function loginClicked() {
	if(state.indexOf("unconnected") !== -1) {
		// Startup
		initWebsocket(); // Create websocket
		connectWS("192.168.0.103","8888", false, "testNick", "testChannel");
		// Initiate login
		user = document.getElementById("jidBox").value;
		jid = user + "@" + host;
		chatNick = document.getElementById("userNameBox").value;
		
	} else if (state.indexOf("connected") !== -1) {
		// Disconnect Stream
		sendCmd(buildDisconnectStanza());
		state = "unconnected";
		updateUIState();
		users = {}; // clear
		updateUserList();
	}
}

function msgSendClicked() {
	var message = document.getElementById("chatInputTxt").value;
	sendCmd(buildMessageStanza(clientUser,chatRoomName+"@conference."+host,clientId,message));
}

function sendClicked() {
	var msg = document.getElementById("sendBox").value;
        sendCmd(msg);
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
			state = "unconnected";
			updateUIState();
			users = {};
			updateUserList();
			console.log(">> WebSockets.onclose");
			disconnect();
			console.log("<< WebSockets.onclose");
		});
		ws.on('error', function(e) {
			state = "unconnected";
			updateUIState();
			users = {};
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
    var rQ, rQi, i;
	//alert(ws.rQlen());
    var arr = ws.rQshiftBytes(ws.rQlen()), str="", chr;

	while (arr.length > 0) {
		chr = arr.shift();
		str += String.fromCharCode(chr);    
	}
        recvMsg(str);
    //}
    //console.log("<< do_recv");
}

function do_send() {
    if (sQ.length > 0) {
        console.log("Sending " + sQ);
        ws.send(sQ);
        sQ = [];
    }
}

function sendCmd(msg) {
    console.log("Sending: " + msg);
    sQ.pushStr(msg + "\r\n");
    do_send();
}

// Handle the message..
function recvMsg(msg) {
    console.log(">> recvMsg('" + msg + "')");
	
	if(msg.indexOf("<mechanism>PLAIN</mechanism>") !== -1 && doPlainLogin) { // Do PLAIN auth, Step 1
		//var startTTLStanza = "<starttls xmlns=\"urn:ietf:params:xml:ns:xmpp-tls\"/>";
		var username = jid.split("@")[0];
		var userPass = '\0' + username + '\0' + password;
		var base64UserPass = encode64(userPass);
		var passwordPlainStanza = "<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>"+base64UserPass+"</auth>";
		sendCmd(passwordPlainStanza);
		//sendCmd("<iq type='get' id='reg1' to='jabber.org'><query xmlns='jabber:iq:register'/></iq>");
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
		sendCmd(buildBindStanza(bridgeClient,1));
	}
	
	if(msg.indexOf("</jid></bind></iq>") !== -1) { // Binding complete TODO: Find a better check
		// get the full client JID
		
		// Perform Disco query
		//sendCmd(buildDiscoStanza(clientUser,jid.split('@')[1], clientId));
		//sendCmd(buildDiscoStanza(clientUser,"bridgechatroom1111@conference.jabber.org", clientId));
		
		clientUser = jid+"/"+bridgeClient;
		
		sendCmd(buildPresenseStanza(clientUser,chatRoomName+"@conference.jabber.org/"+chatNick,clientId));
	}
	
	if(msg.indexOf("<presence") !== -1) {
		msg = "<holder>" + msg + "</holder>";
		var xmlMsgDoc = $.parseXML(msg);
		var $xmlMsg = $(xmlMsgDoc);
		var available = true;
		$xmlMsg.find("presence").each(function(index) {
			var details = {};
			var from = $(this).attr("from");
			var to = $(this).attr("to");
			var type = $(this).attr("type");
			console.log("from >> " + from);
			console.log("to >> " + to);
			userName = from.split('/')[1];
			
			details["nick"] = userName;
			if (userName.indexOf(chatNick) !== -1) {
				details["self"] = true; // this is us.
			} else {
				details["self"] = false; // not us.
			}
			if (type && type.indexOf("unavailable") !== -1) {
				// User unavailable, remove from session
				available = false;
			} else {
				available = true;
			}
			if(available) {
				users[userName] = details;
			}
		});
		updateUserList();
	}
	
	if(msg.indexOf("<ping") !== -1) {
		// Respond with a pong!
		sendCmd(buildPingStanza(clientUser,host,clientId));
	}
	
	if(msg.indexOf("<message") !== -1) {
		var xmlMsgDoc = $.parseXML(msg);
		var $xmlMsg = $(xmlMsgDoc);
		var type = $xmlMsg.find("message").attr("type");
		var fromNick = $xmlMsg.find("message").attr("from").split("/")[1];
		var body = $xmlMsg.find("body").text();
		document.getElementById("chatHistory").innerHTML += "<div class='msgLine'>" + fromNick + ">> " + body + "</div>";
	}

}

function updateUIState() {
	if(state.indexOf("unconnected") !== -1) {
		// Show connection box
		var connectionHolder = document.getElementById("connection");
		connectionHolder.innerHTML = ""; // clear
		connectionHolder.innerHTML = 'JID:<input id="jidBox" value="'+chatNick+'"></input><span id="domainLbl"><i>@'+host+'</i></span>Nick Name:<input id="userNameBox" value="'+chatNick+'"></input>';
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
	$.each(users,function(key,value) {
		if (value["self"] == true) {
			// This is us.
			userDiv += "<div class='selfDiv'><i>"+value["nick"]+"</i></div>";
		} else {
			// Another user.
			userDiv += "<div class='userDiv'>"+value["nick"]+"</div>";
			userDiv += "<button class='userInvBtn' onclick='userInvited("+value["nick"]+")'>Invite</button>";
		}
	});
	userList.innerHTML = userDiv;
}

function addChatMsgDiv() {
	
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
function buildBindStanza(bindName,bindNum) {
	return '<iq type="set" id="bind_'+bindNum+'"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>'+bindName+'</resource></bind></iq>';
}
function buildDisconnectStanza() {
	return '</stream:stream>';
}
function buildMessageStanza(userJID,chatServer,id,msg) {
	return "<message from='"+userJID+"' id='"+id+"' to='"+chatServer+"' type='groupchat'><body>"+msg+"</body></message>";
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