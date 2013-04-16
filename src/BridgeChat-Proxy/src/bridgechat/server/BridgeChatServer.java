/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package bridgechat.server;

import com.netiq.websockify.Websockify;

/**
 *
 * @author Bryce_000
 */
public class BridgeChatServer {

    /**
     * @param args = [port, target host, target port]
     */
    public static void main(String[] args) throws Exception {
        
        Websockify websockifyServer = new Websockify();
       // websockifyServer.enableSSL = true;
        //websockifyServer.keystore = "C:\\Program Files\\Java\\jdk1.7.0_11\\jre\\lib\\security\\cacerts";
        //websockifyServer.keystorePassword = "changeit";
        websockifyServer.doMain(args);
        
    }
}
