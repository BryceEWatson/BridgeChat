/* Protocol Abstraction Class
   Description: Allows the Controller to easily change between protocols.
*/
// Global Vars

// Constructor
function Protocol(type) {
	this.type = type;
	if(type == "XMPP") {
		this.util = new XMPPUtil();
	} else if(type == "custom") {
		this.util = new CustomUtil();
	}
	
}