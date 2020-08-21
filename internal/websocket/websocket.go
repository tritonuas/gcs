package ws

import (
  "github.com/sirupsen/logrus"
	"github.com/gorilla/websocket"
	//"golang.org/x/time/rate"
	"net/http"
	"github.com/golang/protobuf/jsonpb"
	pb "github.com/tritonuas/hub/internal/interop"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var Log *logrus.Logger

type WebSocketClient struct {
	//hub    *hub.Hub
	conn   *websocket.Conn
	mission_report_stream chan interface{}
	plane_obc_stream chan interface{}
	plane_loc_stream chan interface{}
	plane_status_stream chan interface{}
	obstacle_stream chan interface{}
	name   string
}

func (c *WebSocketClient) readPump() {
	defer func() {
		//c.topic.unregister <- c.client
		c.conn.Close()
	}()
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				Log.Info("error: %v", err)
			}
			break
		}
		//c.hub.handleMessage(msg)
	}
}

func (c *WebSocketClient) writePump() {
	defer func() {
		//c.topic.unregister <- c.client
		c.conn.Close()
	}()
	for {
		select {
		case message := <-c.plane_obc_stream:
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			w.Write(message.([]byte))
		case message := <-c.mission_report_stream:
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			sendee := message.(*pb.MissionReportStatus)
			convert := &pb.GCSMessage {
				GcsMessage: &pb.GCSMessage_MissionReport{
					MissionReport: sendee,
				},
			}

			marshaler := jsonpb.Marshaler{
				OrigName:     true,
				EmitDefaults: true,
				Indent:       "    ",
			}
			if err = marshaler.Marshal(w, convert); err != nil {

				Log.Error("error: %s", err.Error())
			}
		case message := <-c.plane_loc_stream:
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			sendee := message.(*pb.PlaneLoc)
			convert := &pb.GCSMessage {
				GcsMessage: &pb.GCSMessage_Loc{
					Loc: sendee,
				},
			}

			marshaler := jsonpb.Marshaler{
				OrigName:     true,
				EmitDefaults: true,
				Indent:       "    ",
			}
			if err = marshaler.Marshal(w, convert); err != nil {

				Log.Error("error: %s", err.Error())
			}
		case message := <-c.plane_status_stream:
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			sendee := message.(*pb.PlaneStatus)
			convert := &pb.GCSMessage {
				GcsMessage: &pb.GCSMessage_Status{
					Status: sendee,
				},
			}

			marshaler := jsonpb.Marshaler{
				OrigName:     true,
				EmitDefaults: true,
				Indent:       "    ",
			}
			if err = marshaler.Marshal(w, convert); err != nil {

				Log.Error("error: %s", err.Error())
			}
		case message := <-c.obstacle_stream:
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				Log.Warning("write error")
				return
			}
			sendee := message.(*pb.Obstacles)
			convert := &pb.GCSMessage {
				GcsMessage: &pb.GCSMessage_Obs{
					Obs: sendee,
				},
			}

			marshaler := jsonpb.Marshaler{
				OrigName:     true,
				EmitDefaults: true,
				Indent:       "    ",
			}
			if err = marshaler.Marshal(w, convert); err != nil {

				Log.Error("error: %s", err.Error())
			}
		}
	}
}

// serveWs handles websocket requests from the peer.
func serveWs(plane_obc_stream chan interface{}, mission_report_stream chan interface{}, plane_loc_stream chan interface{}, plane_status_stream chan interface{},obstacle_stream chan interface{}, w http.ResponseWriter, r *http.Request) {
	Log.Info("Serve WS")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		Log.Warning(err)
		return
	}
	client := &WebSocketClient{conn: conn, mission_report_stream: mission_report_stream, plane_obc_stream:plane_obc_stream, plane_loc_stream:plane_loc_stream,plane_status_stream:plane_status_stream,obstacle_stream:obstacle_stream}
	//topic.register <- newStreamClient(client, rate.Inf)
	client.writePump()
	//client.readPump()
}
