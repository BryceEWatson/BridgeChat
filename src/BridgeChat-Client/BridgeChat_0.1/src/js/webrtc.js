var startBtn, selfView;
window.onload = function() {
	startBtn = document.getElementById('startBtn');
	selfView = document.getElementById('selfView');
}

navigator.getUserMedia_ = (   navigator.getUserMedia
                           || navigator.webkitGetUserMedia 
                           || navigator.mozGetUserMedia 
                           || navigator.msGetUserMedia);

if ( ! navigator.getUserMedia_) {
	alert("getUserMedia is not supported!");
}

function gotStream(stream) {
	alert("here!");
	selfView.src = URL.createObjectURL(stream);
   stream.onended = function () {
     startBtn.disabled = false;
   };
   
}

function streamFailed(err) {
	console.log("The following error occured: " + err.code);
}

 function start() {
   navigator.getUserMedia_({video:true},gotStream, streamFailed);
}
 
 

