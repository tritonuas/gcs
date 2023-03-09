package obc

//TODO: uncomment this when we figure out how to set up the obc/path planning server on github actions

// import (
// 	"net/http"
// 	"reflect"
// 	"testing"

// 	"github.com/tritonuas/gcs/internal/obc/pp"
// )

// // NOTE: PATH PLANNING MUST BE RUNNING

// // data from https://drive.google.com/file/d/19-3MzI56KzF0TrU7c_wY84hq7P5CG2I8/view page 15
// var exampleFlightBounds = []pp.Coordinate{
// 	{38.31729702009844, -76.55617670782419},
// 	{38.31594832826572, -76.55657341657302},
// 	{38.31546739500083, -76.55376201277696},
// 	{38.31470980862425, -76.54936361414539},
// 	{38.31424154692598, -76.54662761646904},
// 	{38.31369801280048, -76.54342380058223},
// 	{38.31331079191371, -76.54109648475954},
// 	{38.31529941346197, -76.54052104837133},
// 	{38.31587643291039, -76.54361305817427},
// 	{38.31861642463319, -76.54538594175376},
// 	{38.31862683616554, -76.55206138505936},
// 	{38.31703471119464, -76.55244787859773},
// 	{38.31674255749409, -76.55294546866578},
// 	{38.31729702009844, -76.55617670782419},
// }

// // data from https://drive.google.com/file/d/19-3MzI56KzF0TrU7c_wY84hq7P5CG2I8/view page 17
// var exampleSearchBounds = []pp.Coordinate{
// 	{38.31442311312976, -76.54522971451763},
// 	{38.31421041772561, -76.54400246436776},
// 	{38.3144070396263, -76.54394394383165},
// 	{38.31461622313521, -76.54516993186949},
// 	{38.31442311312976, -76.54522971451763},
// }

// // These values are made up; we don't actually have a static obstacle avoidance task in the 2023 competition, but we might need to add it back in future years
// var exampleObstacles = []pp.Obstacle{
// 	{38.31442311312976, -76.54522971451763, 1, 2},
// 	{38.31421041772561, -76.54400246436776, 0, 4.7583857},
// 	{38.3144070396263, -76.54394394383165, -5, -6},
// 	{38.31461622313521, -76.54516993186949, -7.637, 8.8583},
// 	{38.31442311312976, -76.54522971451763, 9.54637, -10.6543},
// }

// // I made these values up; they aren't realistic
// var exampleWaypoints = []pp.Waypoint{
// 	{38.31442311312976, -76.54522971451763, 200.583946, 0.573, 15},
// 	{38.31421041772561, -76.54400246436776, 300.9285, -45, 10},
// 	{38.3144070396263, -76.54394394383165, 400.56738, -90, 200.12571},
// 	{38.31461622313521, -76.54516993186949, -250, 999.999999, 25.82952},
// 	{38.31442311312976, -76.54522971451763, 9, -10, -0},
// }

// // Tests that a mission can be successfully sent to the OBC (does not ensure that data is successfully handled; only that it is sent)
// func TestPostMission(t *testing.T) {
// 	tests := []struct {
// 		mission  pp.Mission
// 		expected int // this will be the return code after posting the mission
// 	}{
// 		{mission: pp.Mission{}, expected: http.StatusBadRequest},
// 		{mission: pp.Mission{FlightBoundaries: exampleFlightBounds, SearchBoundaries: exampleSearchBounds, Obstacles: exampleObstacles}, expected: http.StatusOK},
// 	}

// 	for _, tc := range tests {
// 		client := NewClient("127.0.0.1:5010", 5)
// 		_, actual := client.PostMission(&tc.mission)
// 		if !reflect.DeepEqual(tc.expected, actual) {
// 			t.Fatalf("expected: %d, actual: %d", tc.expected, actual)
// 		}
// 	}
// }

// // Tests that airdrop waypoints can be successfully sent to the OBC (does not ensure that data is successfully handled; only that it is sent)
// func TestPostAirdropWaypoints(t *testing.T) {
// 	tests := []struct {
// 		waypoints []pp.Waypoint
// 		expected  int
// 	}{
// 		{waypoints: []pp.Waypoint{}, expected: http.StatusBadRequest},
// 		{waypoints: exampleWaypoints, expected: http.StatusOK},
// 	}

// 	for _, tc := range tests {
// 		client := NewClient("127.0.0.1:5010", 5)
// 		_, actual := client.PostAirdropWaypoints(&tc.waypoints)
// 		if !reflect.DeepEqual(tc.expected, actual) {
// 			t.Fatalf("expected: %d, actual: %d", tc.expected, actual)
// 		}
// 	}
// }

// // TODO: test IsConnected() and all the other stuff on the clickup task
