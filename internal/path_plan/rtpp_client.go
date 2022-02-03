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
	client  *http.Client
	httpClient *ut.Client
	url     string
	timeout int
}

// IsConnected checks to see if hte http client object is not null
func (c *Client) IsConnected() bool {
	return c.client != nil
}


//thinking about having (*Client, HTPPError) to follow the structure of client.go, but realized that there is no actual
//authentization involved, which the original InteropError was used fof
func NewClient(url string, timeout int) *Client {
	client := &Client{

		url:     "http://" + url,
		timeout: timeout,
	}

	cookieJar, _ := cookiejar.New(nil)
	client.client = &http.Client{
		Jar:     cookieJar,
		Timeout: time.Duration(timeout) * time.Second,
	}
	// setup http_client
	client.httpClient = ut.NewClient(url, timeout)


	return client
}

// func (c *Client) post(uri string, msg io.Reader) ([]byte, ut.HTPPError) {
// 	ppErr := ut.NewHTTPError()

// 	resp, err := c.client.Post(c.url+uri, "application/json", msg)

// 	// If err is not nil, then the server is not online and we need to back out
// 	// so that nothing crashes
// 	if err != nil {
// 		Log.Debug(err)
// 		ppErr.SetError("POST", []byte("RTPP Server Offline"), http.StatusBadGateway)
// 		return nil, *ppErr
// 	}

// 	// The server is online, but we need to check the status code directly to
// 	// see if there was a 4xx error
// 	if resp.StatusCode != http.StatusOK {
// 		errMsg, _ := ioutil.ReadAll(resp.Body)
// 		ppErr.SetError("POST", errMsg, resp.StatusCode)
// 	}

// 	defer resp.Body.Close()
// 	body, _ := ioutil.ReadAll(resp.Body)
// 	Log.Debugf("Making Request to RTPP: POST - %s - %d", uri, resp.StatusCode)

// 	return body, *ppErr
// }

func (c *Client) PostMission(mission []byte) ut.HTTPError {
	// Post telemetry to server
	_, err := c.httpClient.Post("/mission", bytes.NewReader(mission))

	return err
}

//implmentation of 4a?? not too sure what I should call in this instance
// func (c *Client) get(uri string) ([]byte, ut.HTTPError){
// 	ppErr := NewHTTPError()

// 	resp, err := c.client.Get(c.url+uri)
// 	if err != nil {
// 		Log.Debug(err)
// 		ppErr.SetError("GET", []byte("RTPP Server Offline"), http.StatusBadGateway)
// 		return nil, *ppErr
// 	}
// 	if resp.StatusCode != http.StatusOK {
// 		errMsg, _ := ioutil.ReadAll(resp.Body)
// 		ppErr.SetError("GET", errMsg, resp.StatusCode)
// 	}
// 	defer resp.Body.Close()
// 	body, _ := ioutil.ReadAll(resp.Body)
// 	Log.Debugf("Making Request to RTPP: GET - %s - %d", uri, resp.StatusCode)

// 	return body, *ppErr
// }

func (c *Client) GetPath() (Path, []byte, ut.HTTPError){
	pathBinary, err := c.httpClient.Get("/path")
	return CreatePath(pathBinary), pathBinary, err
}