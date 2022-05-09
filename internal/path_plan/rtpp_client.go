package path_plan

import (
	"bytes"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	ut "github.com/tritonuas/hub/internal/utils"
)

var Log = logrus.New()

type Client struct {
	httpClient *ut.Client
	url        string
	timeout    int
}

// IsConnected checks to see if the http client object is not null
func (c *Client) IsConnected() bool {
	return c.httpClient != nil
}

// EstablishInteropConnection keeps trying to connect to the rtpp server
// every waitTime seconds, and exits once it has connected
func EstablishRTPPConnection(waitTime int, rtppURL string, timeout int, c chan *Client) {
	Log.Infof("Creating RTPP Client connected to %s", rtppURL)

	var client *Client
	//var err ut.HTTPError

	for {
		// Try creating a new client and authenticating it
		client = NewClient(rtppURL, timeout)
		err := client.validate()

		if err.Get {
			Log.Warningf("Client to RTPP failed. Retrying in %d seconds.", waitTime)
			time.Sleep(time.Duration(waitTime) * time.Second)
		} else {
			Log.Info("RTPP Client successfully connect.")
			break
		}

	}

	c <- client
}

func NewClient(url string, timeout int) *Client {
	client := &Client{

		url:     "http://" + url,
		timeout: timeout,
	}

	// setup http_client
	client.httpClient = ut.NewClient(url, timeout)

	return client
}

func (c *Client) PostMission(mission []byte) ut.HTTPError {
	// Post telemetry to server
	_, err := c.httpClient.Post("/mission", bytes.NewReader(mission))

	return err
}

//Make latitude, longitue, heading, and altitude not be hard coded
func (c *Client) GetPath(latitude float64, longitude float64) (Path, []byte, ut.HTTPError) {
	url := fmt.Sprintf("/path/waypoints?latitude=%f&longitude=%f&altitude=90&heading=0", latitude, longitude)
	pathBinary, err := c.httpClient.Get(url)
	Log.Info(pathBinary)
	return CreatePath(pathBinary), pathBinary, err
}

func (c *Client) validate() ut.HTTPError {
	_, err := c.httpClient.Get("/")
	return err
}
