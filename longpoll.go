package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"time"

	"github.com/eapache/channels"
	pb "github.com/tritonuas/hub/interop"
)

type ObstacleInfo struct {
	MovingObstacles     []pb.MovingObstacle     `json:"moving_obstacles"`
	StationaryObstacles []pb.StationaryObstacle `json:"stationary_obstacles"`
}

type ServerMessage struct {
	Message          string `json:"message"`
	MessageTimestamp string `json:"message_timestamp"`
	ServerTime       string `json:"server_time"`
}

type RequestResult struct {
	requestTime   time.Duration
	completedTime time.Time
	err           error
}

type ServerRequest struct {
	Endpoint string
}

type Telemetry struct {
	latitude     float64
	longitude    float64
	altitude_msl float64
	uas_heading  float64
}

type InteropClient struct {
	client *http.Client

	requestQueue *channels.RingChannel
	telemQueue   *channels.RingChannel

	resultQueue chan *RequestResult

	hub *Hub

	UrlBase  string
	username string
	password string

	obstacleRate int
	connected    bool
}

func printServerMessage(sm *ServerMessage) {
	fmt.Printf("Message: " + sm.Message + "\n")
	fmt.Printf("Server Time: " + sm.ServerTime + "\n")
	fmt.Printf("Message Time: " + sm.MessageTimestamp + "\n")
}

func createInteropClient(hub *Hub, UrlBase string, username string, password string, obstacleRate int) *InteropClient {
	cookieJar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: cookieJar,
	}
	im := InteropClient{
		requestQueue: channels.NewRingChannel(5),
		telemQueue:   channels.NewRingChannel(5),
		client:       client,
		resultQueue:  make(chan *RequestResult),
		hub:          hub,
		UrlBase:      UrlBase,
		username:     username,
		password:     password,
		obstacleRate: obstacleRate,
		connected:    false,
	}

	return &im
}

func (u *InteropClient) Name() string {
	return "judgingserver"
}

func (c *InteropClient) Connected() bool {
	return c.connected
}

func (c *InteropClient) Run() {
	go c.GetObstacles()
	go c.updateTelemetry()
	for {
		c.connected = false
		cookieJar, _ := cookiejar.New(nil)
		c.client = &http.Client{
			Jar: cookieJar,
		}
		resp, err := c.client.PostForm(c.UrlBase+"/api/login", url.Values{
			"username": {c.username},
			"password": {c.password},
		})

		if err != nil || resp.StatusCode != 200 {
			//Log.Warning("Login error, attempting reconnect code:"+string(resp.StatusCode))
			time.Sleep(time.Second)
			if err == nil {
				resp.Body.Close()
			}
			continue
		}
		c.connected = true

		resp.Body.Close()
		for {
			request := <-c.requestQueue.Out()
			err := c.executeRequest(request.(*ServerRequest))
			if err != nil {
				Log.Warning("Request error need to reconnect")
				break
			}
		}
	}
}

func (c *InteropClient) GetObstacles() {
	for {
		var request = new(ServerRequest)
		request.Endpoint = "/api/obstacles"
		c.requestQueue.In() <- request
		time.Sleep(time.Duration((1000 / c.obstacleRate)) * time.Millisecond)
	}
}

func float64ToStr(n float64) string {
	return strconv.FormatFloat(n, 'f', -1, 64)
}

func (c *InteropClient) executeRequest(request *ServerRequest) (err error) {
	//start := time.Now()
	//var rresult = new(RequestResult)
	res, err := c.client.Get(c.UrlBase + request.Endpoint)
	if err != nil {
		Log.Warning("HTTP execute Request error")
		//rresult.err = err
		//c.resultQueue <- rresult
		return err
	}
	if res.StatusCode != 200 {
		Log.Warning("HTTP execute Request error")
		return err
	}
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		fmt.Printf("client error")
		//rresult.err = err
		//c.resultQueue <- rresult
		return err
	}
	// send result to queues
	c.hub.sendStreamMessage(body, "obstacle_data")

	//rresult.requestTime = time.Now().Sub(start)
	//rresult.completedTime = time.Now()
	//c.resultQueue <- rresult
	res.Body.Close()
	return nil
}

func (c *InteropClient) getMission(w http.ResponseWriter, r *http.Request) {

	res, err := c.client.Get(c.UrlBase + "/api/missions/1")
	if err != nil {
		Log.Warning("HTTP execute Request error")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if res.StatusCode != 200 {
		Log.Warning("HTTP execute Request error")
		http.Error(w, strconv.Itoa(res.StatusCode), res.StatusCode)
		return
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// c.hub.missionreporting.SetMission(body)

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
	res.Body.Close()
}

func (c *InteropClient) Send(message []byte) bool {
	var loc map[string]interface{}
	err := json.Unmarshal(message, &loc)
	if err != nil {
		Log.Warning("InteropClient.Send(): json decode error - ", err)
		return false
	}
	var dat map[string]interface{}
	dat = loc["data"].(map[string]interface{})
	var telemData = new(Telemetry)
	telemData.latitude = dat["lat"].(float64)
	telemData.longitude = dat["lon"].(float64)
	telemData.altitude_msl = dat["a_rel"].(float64)
	telemData.uas_heading = dat["head"].(float64)
	c.telemQueue.In() <- telemData
	return true
}

func (c *InteropClient) Close() {}

func (c *InteropClient) updateTelemetry() {
	for {
		telemData := (<-c.telemQueue.Out()).(*Telemetry)
		resp, err := c.client.PostForm(c.UrlBase+"/api/telemetry", url.Values{
			"latitude":     {float64ToStr(telemData.latitude)},
			"longitude":    {float64ToStr(telemData.longitude)},
			"altitude_msl": {float64ToStr(telemData.altitude_msl)},
			"uas_heading":  {float64ToStr(telemData.uas_heading)}})

		// TODO: handle errors
		/*if err != nil || resp.StatusCode != 200 {
			resp.Body.Close()
		 }*/
		if err == nil {
			resp.Body.Close()
		} else {
			Log.Warning("telem send failed")
		}
		time.Sleep(300 * time.Millisecond)
	}
}
