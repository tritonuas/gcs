package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"
	"io/ioutil"
	ut "github.com/tritonuas/hub/internal/utils"
)
var server *Server
var client *ut.Client

func TestNewClient(t *testing.T) {
	//copied over from other client testers, put here as a filler, not sure about what the port should be
	client, err := NewClient("127.0.0.1:5000",10)
	
	if err.Post {
			t.Error("Expected successful login, but login was unsuccessful.")
	}
}
//Tests the general section of the wiki, by first posting, then retrieving the same value from it
func TestGeneral(t *testing.T) {
	_, err := client.Post("hub/mission", bytes.NewReader(1))
	if err.Post {
		t.Error("Post Error")
	}
	val, err := client.Get("hub/mission")
	if err.Get {
		t.Error("Get Error")
	}
	if val != 1 {
		t.Error("Not properly posted")
	}
}
//Tests the plane endpoints section of the wiki
func TestPlane(t *testing.T) {
	position, err := client.Get("hub/plane/position")
	//do some json umarshalling here and check the get
	telemetry, err := client.Get("hub/plane/telemetry?id=30&field=yaw")
	//do some json unmarshalling her and check the get
	_, err := client.Post("hub/plane/home", bytes.NewReader(position_dummy))
	//position dummy doesn't exist i'm just putting it there to be used
	home, err := client.Get("hub/plane/home")
	//do some json unmarshalling here and check the get
	_, err := client.Post("hub/plane/path", bytes.NewReader(position_dummy))
	//position dummy doesn't exist i'm just putting it there to be used
	home, err := client.Get("hub/plane/path")
	//do some json unmarshalling here and check the get
}

func TestInterop(t *testing.T) {
	teams, err := client.Get("hub/interop/teams")
	//json
	missions, err := client.Get("hub/interop/missions")
	//json
	_, err := client.Post("hub/interop/telemtry", bytes.NewReader(telemtry_dummy))
	//similar to other posts just make sure works
	telem, err := client.Get("hub/interop/telemtry")
	//json, linked to previous post
	//odlcs after this
	//----------------
	odlcsPost, err := client.Post("hub/interop/odlcs", byte.NewReader(odlcs_dummy))
	//json
	odlcsPostP, err := client.Get("hub/interop/odlcs")
	//make sure that odlcsPostP is equivlaent to the odlcsPost
	//odlc after this
	//-----------------
	odlcPost, err := client.Post("hub/interop/odlc/1", byte.NewReader(odlc_dummy))
	//json
	odlcPostP, err := client.Get("hub/interop/odlc/1")
	//make sure that odlcPostP is equivalent to odlcPost
	_, err := client.Delete("hub/interop/odlc/1")
	if err.Delete{
		t.Error("Delete error")
	}
	//odlc image stuff after this
	_, err := client.Put("hub/interop/odlc/image/1", byte.NewReader(image_dummy))
	//json
	image, err := client.Get("hub/interop/odlc/image/1")
	//make sure that image_dummy or whatever value is passed in is equivalent to image
	_, err := client.Delete("hub/interop/odlc/image/1")
	if err.Delete{
		t.Error("Delete error")
	}
}
//functions to test
//localhost5000
//Line 41 Run 
//I think that you should be able to see if server actually worked if you were able to get a server up and then see if there are tangible changes by getting the values posted
//Line 90 pathPlanHandler ServeHttp (has only a Get case) actually not too sure how that owuld work since it would tell you the error status?
//Line 116 Server connectToInterop not too