New Demo Page
==========
Check out the new demo page over at www.bridgechat.net !

BridgeChat
==========

This project works to combine multiple technologies, old and new, to create an entirely web-based video conferencing application using WebRTC. The project, given the codename ‘Bridge Chat’, consists of three main pieces: The Client, Custom Server, and the Proxy Server. The client is the largest and most complex portion, containing 5 functional entities, and is intended to stand alone, requiring only a single HTML DIV element and a minimal amount of CSS.

The Client is responsible for providing a simple chat interface to the user, which allows them to connect to either an external XMPP server, or a local instance of the Custom Server. Different components are loaded and used in the Client, depending on which protocol is specified on startup by the administrator. These protocol-specific components allow the client to create either XML or JSON based messages to interact with their respective server in a way which allows the user to establish video chat sessions with other users. A detailed description of how both protocols function is included below in the Development Details.

The Custom Server is implemented in Java, and is packaged as a runnable JAR file which can be easily deployed to any linux-based server. This application acts as a Websocket server for the client program, listening for incoming connections on the specified port. A simple presence mechanism notifies all existing users of the joining or leaving of any other users. In addition to this it also provides messaging between users, allowing them to exchange WebRTC session details before establishing connections between each other separately. All messages sent from the server are in pure JSON, as this is the easiest for a Javascript client to understand.

The Proxy Server arose from the need to connect the client application with the many existing legacy XMPP servers which do not support Websocket connections. The Proxy Server acts as a simple intermediary between the Client and the desired XMPP server. Client facing Websocket connections are paired with Java Socket connections to the specified IP and Port of the XMPP server. The proxy is paired with a modified Websocket on the client that accepts stream data directly from the socket connection in a way similar to regular Websocket messages.

Installation
==========

Installation steps are described in the BridgeChat-Installation_Manual.pdf.

Future Goals & Intent
==========

The main goal of this project is to provide the WebRTC developer community with a functional multi-user video chat program which could be improved and expanded upon as the specifications evolve.

This application will be continously improved to better server the needs of Website developers and designers when there is a need for live audio/video conferencing. This application can be easily embedded within an existing website and, with future improvements, will provide a useful RTC features.  
