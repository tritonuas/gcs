package interopconn;

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"time"
	"strconv"
	pb "github.com/tritonuas/hub/interop"
)

func NewInteropClient(urlBase string, username string, password string) (*interopClient){
	cookieJar, _ := cookiejar.New(nil)
	client := &interopClient{username: username, urlBase: urlBase, password: password, client:&http.Client{Jar: cookieJar}}
	go client.run()
	return client
}

func float64ToStr(n float32) string {
	return strconv.FormatFloat(float64(n), 'f', -1, 32)
}

type interopClient struct {
	client *http.Client

	urlBase  string
	username string
	password string

	connected    bool
	refreshConn bool
}

func (c *interopClient) Connected() bool {
	return c.connected
}

func (c *interopClient) setCredentials(urlBase string, username string, password string) {
	c.urlBase = urlBase;
	c.username = username;
	c.password = password;
	c.refreshConn = true;
}

func (c *interopClient) PostTelemetry(telem *pb.Telemetry) (error) {
	resp, err := c.client.PostForm(c.urlBase+"/api/telemetry", url.Values{
		"latitude":     {float64ToStr(telem.GetLatitude())},
		"longitude":    {float64ToStr(telem.GetLongitude())},
		"altitude_msl": {float64ToStr(telem.GetAltitudeMsl())},
		"uas_heading":  {float64ToStr(telem.GetUasHeading())}})
	// TODO: handle errors
	if err != nil || resp.StatusCode != 200 {
		fmt.Printf("client error")
		c.refreshConn = true
		if err == nil {
			resp.Body.Close()
		} 
		return err
	}

	return nil
}

func (c *interopClient) makeRequest(request string) ([]byte, error) {
	res, err := c.client.Get(c.urlBase + request)
	if err != nil {
		Log.Warning("HTTP execute Request error")
		c.refreshConn = true
		return nil, err
	}
	if res.StatusCode != 200 {
		Log.Warning("HTTP execute Request error")
		c.refreshConn = true
		return nil, err
	}
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		fmt.Printf("client error")
		c.refreshConn = true
		return nil, err
	}
	res.Body.Close()

	return body, nil
}

func (c *interopClient) run() {
	//go c.GetObstacles()
	//go c.updateTelemetry()
	Log.Warning("interopclient run")
	for {
		c.refreshConn = false
		c.connected = false
		cookieJar, _ := cookiejar.New(nil)
		c.client = &http.Client{
			Jar: cookieJar,
		}
		resp, err := c.client.PostForm(c.urlBase+"/api/login", url.Values{
			"username": {c.username},
			"password": {c.password},
		})

		if err != nil || resp.StatusCode != 200 {
			Log.Warning("Login error, attempting reconnect")
			Log.Warning(c.urlBase)
			Log.Warning(c.username)
			Log.Warning(c.password)
			time.Sleep(time.Second)
			if err == nil {
				resp.Body.Close()
			}
			continue
		}
		c.connected = true

		resp.Body.Close()
		for {
			if c.refreshConn {
				Log.Warning("Triggered reconnect")
				break
			}
			time.Sleep(time.Millisecond*10)
		}
	}
}
