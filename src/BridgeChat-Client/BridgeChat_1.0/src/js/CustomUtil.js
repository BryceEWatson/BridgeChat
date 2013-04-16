/* Custom Utilities Class
   Description: Provides custom protocol functionality to the application
*/

// Constructor
function CustomUtil() {

	this.builder = function(type,stanzaVars) {
		console.log("builder>> " + type);
		switch (type)
		{
			case "join":
				json = {
					type: type,
					nick: stanzaVars['nick']
				};
				return JSON.stringify(json);
			case "leave":
				json = {
					type: type,
					nick: stanzaVars['nick']
				};
				return JSON.stringify(json);
			case "message":
				json = {
					type: stanzaVars['type'],
					to: stanzaVars['to'],
					from: stanzaVars['from'],
					message: stanzaVars['message']
				};
				return JSON.stringify(json);
		}
	}
	
}