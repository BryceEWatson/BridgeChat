/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package bridgechat.server;

import java.net.InetSocketAddress;
import java.net.UnknownHostException;
import org.java_websocket.server.WebSocketServer;

/**
 *
 * @author Bryce_000
 */
public class BridgeChatServer {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) throws UnknownHostException {
        // Start server
        InetSocketAddress addr = new InetSocketAddress(8888);
        WebSocketServer server = new bridgechat.server.WebSocketServer(addr);
        server.start();
    }
}
