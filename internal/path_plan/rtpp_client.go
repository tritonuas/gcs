package path_plan

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"time"
	
	"github.com/sirupsen/logrus"
)

var Log = logrus.New()

type client struct{
	client 		*http.Client
	url 		string 
	timeout 	int
}

// IsConnected checks to see if hte http client object is not null
func (c *Client) IsConnected() bool {
	return c.client != nil
}

func EstablishRTPPConnection(waitTime int, rtppURL string, timeout int, c chan *Client){
	Log.Infof("Creating RTPP Client connected to %s", rtppURL)

	var client *Client
	var err RTPPError
	for{
		client, err = NewClient(rtppURL, timeout)
		//don't think this loop is necessary since I have no idea what would be an actual error
		//given that NewClient doesn't currently return any error no matter what
		if err.Post{
			Log.Warningf("Client to RTPP failed. Retrying in %d seconds.", waitTime)
			time.Sleep(time.Duration(waitTime) * time.Second)
		} else{
			Log.Info("RTPP Client successfully authenticated.")
			break
		}
	}
	c <- client
}

//thinking about having (*Client, RTPPError) to follow the structure of client.go, but realized that there is no actual
//authentization involved, which the original InteropError was used fof
func NewClient(url string, timeout int) (*Client){
	client := &Client{
		
		url: "http://" + url,
		timeout: timeout,
	}

	cookieJar, _ := cookiejar.New(nil)
	client.client = &http.Client{
		Jar:		cookieJar,
		Timeout:	time.Duration(timeout) * time.Second,
	}

	return client 
}

func (c *Client) post(uri string, msg io.Reader) ([]byte, rtpp_error) {
	ppErr := NewRTPPError()

	resp, err := c.client.Post(c.url+uri, "application/json", msg)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		ppErr.SetError("POST", []byte("RTPP Server Offline"), http.StatusBadGateway)
		return nil, *ppErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != http.StatusOK {
		errMsg, _ := ioutil.ReadAll(resp.Body)
		ppErr.SetError("POST", errMsg, resp.StatusCode)
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	Log.Debugf("Making Request to RTPP: POST - %s - %d", uri, resp.StatusCode)

	return body
}

func (c *Client) PostMission(mission []byte) RTPPError {
	// Post telemetry to server
	_, err := c.Post("/mission", bytes.NewReader(mission))

	return err
}

