/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package bridgechat.server;

import java.net.InetSocketAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

/**
 *
 * @author Bryce_000
 */
public class WebSocketServer extends org.java_websocket.server.WebSocketServer{
    
    private static HashMap<String,WebSocket> activeUsers;
    private static ArrayList<String> userNames;

    
    public WebSocketServer(InetSocketAddress address) throws UnknownHostException {
        super(address);
        WebSocketServer.activeUsers = new HashMap<>();
        WebSocketServer.userNames = new ArrayList<>();
    }
    
    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println( "new connection to " + conn.getRemoteSocketAddress() );
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println( "closed " + conn.getRemoteSocketAddress() + " with exit code " + code + " additional info: " + reason );
        String name = getNameFromConnection(conn);
        if(name.length() > 0) {
            String[] vars = {name};
            activeUsers.remove(name);
            userNames.remove(name);
            notifyAll("user-left", vars);
        }
    }
    

    @Override
    public void onMessage(WebSocket conn, String message) {
        System.out.println( "received message form " + conn.getRemoteSocketAddress() + ": " + message );
        JSONParser parser = new JSONParser();
        try {
            JSONObject jsonObject = (JSONObject)parser.parse(message);
            String type = (String)jsonObject.get("type");
            System.out.println("Type: " + type);
            if(type.equals("join")) {
                
                String nick = (String)jsonObject.get("nick");
                WebSocketServer.activeUsers.put(nick,conn);
                WebSocketServer.userNames.add(nick);
                JSONObject jsonOb = new JSONObject();
                jsonOb.put("type", "join-success");
                System.out.println("Sending: "+jsonOb.toJSONString());
                conn.send(jsonOb.toJSONString());
                // Notify everyone of updated user list.
                notifyAll("users",null);
            } else if(type.equals("candidate") || type.equals("spd") || type.equals("session-offer")) {
                String toNick   = (String)jsonObject.get("to");
                String fromNick = (String)jsonObject.get("from");
                //String msgContent  = (String)jsonObject.get("message");
                if(toNick != null && activeUsers.get(toNick) != null) {
                    JSONObject jsonOb = new JSONObject();
                    jsonOb.put("type", type);
                    jsonOb.put("from", fromNick);
                    jsonOb.put("to", toNick);
                    jsonOb.put("message", jsonObject.get("message"));
                    ((WebSocket)activeUsers.get(toNick)).send(jsonOb.toJSONString());
                }
            }
        } catch (ParseException ex) {
            Logger.getLogger(WebSocketServer.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    public void notifyAll(String type,String[] vars) {
        System.out.println("notifyAll>> "+type);
        Iterator it = WebSocketServer.activeUsers.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry pairs = (Map.Entry)it.next();
            System.out.println(pairs.getKey() + " = " + pairs.getValue());
            if(type.equals("users")) {
                JSONObject jsonOb = new JSONObject();
                jsonOb.put("type", "user-list");
                jsonOb.put("userNames",this.userNames);
                ((WebSocket)pairs.getValue()).send(jsonOb.toJSONString());
            } else if(type.equals("user-left")) {
                JSONObject jsonOb = new JSONObject();
                jsonOb.put("type", "user-left");
                jsonOb.put("user", vars[0]);
                ((WebSocket)pairs.getValue()).send(jsonOb.toJSONString());
            }
        }
    }
    
    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.out.println( "an error occured on connection " + conn + ":" + ex );
    }
    
    public String getNameFromConnection(WebSocket connection) {
        Iterator it = WebSocketServer.activeUsers.entrySet().iterator();
        while(it.hasNext()) {
            Map.Entry pairs = (Map.Entry)it.next();
            System.out.println(pairs.getKey() + " = " + pairs.getValue());
            if(((WebSocket)pairs.getValue()).equals(connection)) {
                return (String)pairs.getKey();
            }
        }
        return "";
    }
}
