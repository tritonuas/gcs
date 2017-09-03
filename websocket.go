package main

import (
	//"github.com/Sirupsen/logrus"
	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
	"net/http"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketClient struct {
	hub    *Hub
	topic  *Topic
	conn   *websocket.Conn
	client *StreamClient
	send   chan []byte
	name   string
}

func (c *WebSocketClient) Send(message []byte) bool {
	select {
	case c.send <- message:
		return true
	default:
		return false
	}
}

func (c *WebSocketClient) Close() {
	close(c.send)
}

func (c *WebSocketClient) readPump() {
	defer func() {
		//c.topic.unregister <- c.client
		c.conn.Close()
	}()
	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				Log.Info("error: %v", err)
			}
			break
		}
		c.hub.handleMessage(msg)
	}
}

func (c *WebSocketClient) writePump() {
	defer func() {
		//c.topic.unregister <- c.client
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			w.Write(message)

			// write message from channel
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(message)
				if err := w.Close(); err != nil {
					Log.Warning(err)
					return
				}
			}
		}
	}
}

// serveWs handles websocket requests from the peer.
func serveWs(hub *Hub, topic *Topic, w http.ResponseWriter, r *http.Request) {
	Log.Info("Serve WS")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		Log.Warning(err)
		return
	}
	client := &WebSocketClient{topic: topic, hub: hub, conn: conn, send: make(chan []byte, 1024)}
	topic.register <- newStreamClient(client, rate.Inf)
	go client.writePump()
	client.readPump()
}
