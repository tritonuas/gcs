package interopconn;

import (
	pb "github.com/tritonuas/hub/interop"
	"github.com/golang/protobuf/jsonpb"
	"github.com/sirupsen/logrus"
	"time"
)

var Log *logrus.Logger

// Needs Renaming and cleanup
func NewInteropReport(urlBase string, username string, password string, obstacleRate int) (*InteropReport) {
	client := NewInteropClient(urlBase, username, password)
	report := &InteropReport{client: client, obstacleRate: obstacleRate, clients: make(map[chan *pb.Obstacles]bool)}
	go report.Run()
	return report
}

type InteropReport struct {
	client *interopClient

	obstacleRate int

	clients map[chan *pb.Obstacles]bool
}

func (c *InteropReport) Run() {
	c.runStream()
}

func (c *InteropReport) runStream() {
	for {
		obstacles, err := c.GetObstacles()
		if err == nil {
			for client := range c.clients {
				client <- obstacles
			}
		}
		time.Sleep(time.Duration((1000 / c.obstacleRate)) * time.Millisecond)
	}
}

func (c *InteropReport) GetMission() (*pb.Mission, error) {
	body, err := c.client.makeRequest("/api/missions/1")
	if err != nil {
		return nil, err
	}

	mission := &pb.Mission{}
	if err = jsonpb.UnmarshalString(string(body), mission); err != nil {
		Log.Error("error: %s", err.Error())
		return nil, err
	}
	return mission, nil
}

func (c *InteropReport) GetObstacles() (*pb.Obstacles, error) {
	body, err := c.client.makeRequest("/api/obstacles")
	if err != nil {
		return nil, err
	}

	obstacles := &pb.Obstacles{}
	if err = jsonpb.UnmarshalString(string(body), obstacles); err != nil {
		Log.Error("error: %s", err.Error())
		return nil, err
	}
	return obstacles, nil
}

func (c *InteropReport) PostTelemetry(telem *pb.Telemetry) (error) {
	return c.client.PostTelemetry(telem)
}

func (c *InteropReport) ObstacleStream() (chan *pb.Obstacles, error) {
	ch := make(chan *pb.Obstacles)
	c.clients[ch] = true
	return ch, nil
}




