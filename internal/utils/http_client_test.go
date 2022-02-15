package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"
)

var client *Client

func TestNewClient(t *testing.T) {
	//copied over from other client testers, put here as a filler, not sure about what the port should be
	client, err := NewClient("127.0.0.1:8000",10)
	
	if err.Post {
			t.Error("Expected successful login, but login was unsuccessful.")
	}
}
func TestPost(t *testing.T){
	_, err := Post("/mission", bytes.NewReader("mission"))
	if err.Post {
		t.Error("Post Error")
	}
}
func TestGet(t *testing.T){
	_, err := Get("/mission")
	if err.Get {
		t.Error("Get Error")
	}
}
func TestPut(t *testing.T){
	_, err := Put("/mission", bytes.NewReader("mission"))
	if err.Put {
		t.Error("Put Error")
	}
}
func TestDelete(t *testing.T){
	_, err := Delete("/mission")
	if err.Delete {
		t.Error("Delete Error")
	}
}

