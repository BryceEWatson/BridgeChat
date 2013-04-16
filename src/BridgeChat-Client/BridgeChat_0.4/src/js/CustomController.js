/*
Custom Controller
Description: Handles all high level logic when the application is using the custom Bridge Server.
             Initiate by running customStartup()
*/
var chatDomain;

function customStartup(domain) {
	chatDomain = domain
	console.log("onStartup>>");
	// Create the Data Manager
	dataManager = new WebsocketManager("192.168.0.103","8889", false);
	// Init the Data Layer
	dataManager.init(handleMessage, handleDataOpened, handleDataClosed, handleDataError);
	// Create Protocol Manager
	protoManager = new Protocol("custom");
	uiManager = new UIManager("custom", chatDomain);
	console.log("onStartup<<");
}

