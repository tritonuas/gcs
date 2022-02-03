package path_plan

import (
	"bytes"
	//"io"
	//"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"time"

	"github.com/sirupsen/logrus"
	ut "github.com/tritonuas/hub/internal/utils"
)

var Log = logrus.New()

type Client struct {
	httpClient *ut.Client
	url     string
	timeout int
}

// IsConnected checks to see if the http client object is not null
func (c *Client) IsConnected() bool {
	return c.httpClient != nil
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

func (c *Client) GetPath() (Path, []byte, ut.HTTPError){
	pathBinary, err := c.httpClient.Get("/path")
	return CreatePath(pathBinary), pathBinary, err
}