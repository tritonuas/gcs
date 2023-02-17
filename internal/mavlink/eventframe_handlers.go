package mav

import (
	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"
)

// EventFrameHandler is type of function that takes a Mavlink
// EventFrame and performs further processing on it.
//
// If you want to add some functionality that deals with incoming EventFrames,
// create a function with the matching signature. Currently these handlers
// are used in the Listen method in mavlink/client.go, where all incoming
// EventFrames will be fed into them.
type EventFrameHandler func(*Client, *gomavlib.EventFrame, *gomavlib.Node)

// forwardEventFrame forwards event frames to all other channels except the
// channel the frame originated from
func (c *Client) forwardEventFrame(evt *gomavlib.EventFrame, node *gomavlib.Node) {
	node.WriteFrameExcept(evt.Channel, evt.Frame)
}

// forwardEventFrame forwards messages to all other channels except the
// channel the message originated from
func (c *Client) forwardMessage(evt *gomavlib.EventFrame, node *gomavlib.Node) { //nolint: unused
	node.WriteMessageExcept(evt.Channel, evt.Frame.GetMessage())
}

// writeMsgToInfluxDB will take an eventFrame and write the data from the
// Mavlink message to InfluxDB (if it's one of the messages we want to store)
// TODO: add signals board messages and anything else that seems useful
func (c *Client) writeMsgToInfluxDB(evt *gomavlib.EventFrame, node *gomavlib.Node) {
	if !c.influxdbClient.IsConnected() {
		return
	}
	msg := evt.Frame.GetMessage()
	msgName := ""
	data := make(map[string]interface{})

	switch msg := msg.(type) {
	case *common.MessageGlobalPositionInt:
		msgName = "GLOBAL_POSITION_INT"

		data["time_boot_ms"] = msg.TimeBootMs
		data["lat"] = msg.Lat
		data["lon"] = msg.Lon
		data["alt"] = msg.Alt
		data["relative_alt"] = msg.RelativeAlt
		data["vx"] = msg.Vx
		data["vy"] = msg.Vy
		data["vz"] = msg.Vz
		data["hdg"] = msg.Hdg

	case *common.MessageAttitude:
		msgName = "ATTITUDE"

		data["time_boot_ms"] = msg.TimeBootMs
		data["roll"] = msg.Roll
		data["pitch"] = msg.Pitch
		data["yaw"] = msg.Yaw
		data["rollspeed"] = msg.Rollspeed
		data["pitchspeed"] = msg.Pitchspeed
		data["yawspeed"] = msg.Yawspeed

	case *common.MessageVfrHud:
		msgName = "VFR_HUD"

		data["airspeed"] = msg.Airspeed
		data["groundspeed"] = msg.Groundspeed
		data["heading"] = msg.Heading
		data["throttle"] = msg.Throttle
		data["alt"] = msg.Alt
		data["climb"] = msg.Climb
	}

	// If we parsed a message then write it. Otherwise it can be ignored
	if msgName != "" && len(data) != 0 {
		Log.Infof("writing %s to influx", msgName)
		err := c.influxdbClient.Write(msgName, msg.GetID(), data)
		if err != nil {
			Log.Errorf("Cannot write message %s to InfluxDB. Reason: %s", msgName, err.Error())
		}
	}
}

// handleMissionUpload will process frames associated with uploading a mission.
//
// Steps:
//  1. GCS sends MISSION_COUNT (use StartMissionUpload function)
//  2. Plane sends MISSION_REQUEST_INT
//  3. GCS sends MISSION_ITEM_INT
//  4. Steps 2 and 3 and repeated until all waypoints have been sent
//  5. Plane sends MISSION_ACK
//
// See https://mavlink.io/en/services/mission.html#uploading_mission for details
// on the entire mission uploading process.
// TODO: Check client for an update to a channel to know
// when to upload mission and what the waypoints are.
// Client has to have previously sent a MISSION_COUNT message to the plane
func (c *Client) handleMissionUpload(evt *gomavlib.EventFrame) {
	switch evt.Frame.GetMessage().(type) {
	case *common.MessageMissionAck:
		// TODO: save if mission upload suceeded/failed
	case *common.MessageMissionRequestInt:
		// TODO: send MISSION_ITEM_INT back to plane channel
	case *common.MessageMissionRequest:
		// TODO: send MISSION_ITEM back to plane channel (deprecated)
	}
}

// handleMissionUpload will process frames associated with uploading a mission.
//
// Steps:
//  1. GCS sends MISSION_REQUEST_INT (use StartMissionDownload function)
//  2. Plane sends MISSION_COUNT
//  3. GCS sends MISSION_REQUEST_INT
//  4. Steps 2 and 3 and repeated until all waypoints have been sent
//  5. GCS sends MISSION_ACK
//
// See https://mavlink.io/en/services/mission.html#download_mission for details
// on the entire mission downloading process.
// TODO: Client has to have previously sent a MISSION_REQUEST_LIST message to the plane
func (c *Client) handleMissionDownload(evt *gomavlib.EventFrame) {
	switch evt.Frame.GetMessage().(type) {
	case *common.MessageMissionCount:
		// TODO: send MISSION_REQUEST_INT
	case *common.MessageMissionItemInt:
		// TODO: save to currMission and send MISSION_REQUEST_INT
	case *common.MessageMissionItem:
		// TODO: save to currMission and send MISSION_REQUEST (deprecated)
	}
}

// monitorMission will handle messages relating to the progress of the current mission
// and which mission is currently on the plane.
func (c *Client) monitorMission(evt *gomavlib.EventFrame) {
	switch evt.Frame.GetMessage().(type) {
	case *common.MessageMissionItemReached:
		// TODO: save to currMissionProgress
	case *common.MessageMissionCurrent:
		// TODO: save to currMission
	}
}
