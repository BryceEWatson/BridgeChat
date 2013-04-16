
var w = new WebSocket("ws://conference.jabber.org, protocol);

w.onopen = function() {
  console.log("open");
  w.send("Connection open");
  }
  w.onmessage = function(e) {
  console.log(e.data);
  }
  w.onclose = function(e) {
  console.log("closed");
  }
  w.onerror = function(e) {
  console.log("error");
 }