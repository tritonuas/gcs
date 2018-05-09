package hub_def

import "encoding/json"
import "github.com/Sirupsen/logrus"
import "golang.org/x/time/rate"
import "time"
import "os/exec"

var Log *logrus.Logger


type Sender interface {
	Send(interface{}) bool
	Close()
}

type Status interface {
	Connected() bool
	Name() string
}

type Endpoint interface {
	Send([]byte) bool
	Connected() bool
	Run()
	Name() string
	Close()
}

type StreamClient struct {
	send (chan interface{})
	rate *rate.Limiter
}

func newStreamClient(client chan interface{}, limit rate.Limit) *StreamClient {
	var r *rate.Limiter
	r = rate.NewLimiter(limit, 1)

	return &StreamClient{send: client, rate: r}
}


type Hub struct {
	// Streams
	Topics map[string]*Topic

	// Endpoints
	endpoints map[string]Endpoint

	// Endpoints
	gcsfrontend   *Topic
	obcfrontend   *Topic
	pathplan      Sender
	dronekitproxy Sender
}

type Topic struct {
	clients map[*StreamClient]bool

	// Messages to the clients
	broadcast chan interface{}

	// Register requests from the clients.
	register chan *StreamClient

	// Unregister requests from clients.
	unregister chan *StreamClient

	name string
}

func NewTopic(name string) *Topic {
	return &Topic{
		broadcast:  make(chan interface{}, 1024),
		register:   make(chan *StreamClient),
		unregister: make(chan *StreamClient),
		clients:    make(map[*StreamClient]bool),
		name:       name,
	}
}

func CreateHub() *Hub {
	return &Hub{Topics: make(map[string]*Topic), endpoints: make(map[string]Endpoint)}
}

func (h* Topic) Subscriber(rate int) (chan interface{}){
	channel := make(chan interface{}, 1024)
	h.register <- newStreamClient(channel, 3.0)
	return channel
}

func (h *Topic) Connected() bool {
	return (len(h.clients) > 0)
}

func (h *Topic) Name() string {
	return h.name
}

func (h *Topic) Send(message interface{}) bool {
	select {
	case h.broadcast <- message:
		return true
	default:
		return false
	}
}

func (h *Topic) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				if !client.rate.Allow() {
					continue
				}
				client.send <-(message) 
				Log.Info("send")
				Log.Info(client)
				/*{
					delete(h.clients, client)
				}*/
			}
		}
	}
}

func (h *Topic) Close() {
	close(h.broadcast)
}

type HubMessage struct {
	Type      string           `json:"type"`
	Recepient string           `json:"rec"`
	Data      *json.RawMessage `json:"data"`
}

func (h *Hub) handleMessage(bytes []byte) {
	var msg HubMessage

	err := json.Unmarshal(bytes, &msg)
	if err != nil {
		Log.Warning("Error unmarshaling hub message")
		return
	}
	switch msg.Type {
	case "stream":
		h.sendStreamMessage([]byte(*msg.Data), msg.Recepient)
	case "send":
		h.sendEndpointMessage([]byte(*msg.Data), msg.Recepient)
	default:
		Log.Warning("type not recognized")
	}
}

func (h *Hub) sendStreamMessage(bytes []byte, name string) {
	Log.WithFields(logrus.Fields{
		"name": name,
	}).Debug("stream message")
	if _, ok := h.Topics[name]; ok {
		h.Topics[name].Send(bytes)
	} else {
		Log.Warning("Not a valid topic name")
	}
}

func (h *Hub) sendEndpointMessage(bytes []byte, name string) {
	Log.WithFields(logrus.Fields{
		"name": name,
	}).Debug("send message")
	if _, ok := h.endpoints[name]; ok {
		h.endpoints[name].Send(bytes)
	} else {
		Log.Warning("Not a valid endpoint name")
	}
}

func (h *Hub) AddTopic(name string) {
	topic := NewTopic(name)
	go topic.Run()
	h.Topics[name] = topic
}

type HubStatusMessage struct {
	Type string          `json:"type"`
	Data map[string]bool `json:"data"`
}

func printStatus(hub *Hub, statusList []Status) {
	var m map[string]bool
	m = make(map[string]bool)
	for {

		for _, v := range hub.endpoints {
			m[v.Name()] = v.Connected()
		}
		for _, v := range statusList {
			m[v.Name()] = v.Connected()
		}
		// status of judging server and sitl
		_, err1 := exec.Command("sh", "-c", "docker ps | grep sitl-ucsd").Output()
		m["sitl"] = true
		if err1 != nil {
			m["sitl"] = false
		}

		// print status data
		Log.Info("")
		Log.Info("Status update")
		for k, v := range m {
			Log.WithFields(logrus.Fields{
				"connected": v,
			}).Info(k)
		}

		// create status message
		var msg HubStatusMessage
		msg.Type = "HUB_STATUS_UPDATE"
		msg.Data = m

		bytes, err := json.Marshal(msg)
		if err == nil {
			hub.sendEndpointMessage(bytes, "gcs")
			Log.Info("sent status update")
		}
		time.Sleep(time.Second * 3)
	}
}
