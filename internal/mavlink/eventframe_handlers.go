package mav

import (
	"fmt"

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
	// msg := evt.Frame.GetMessage()

	// if msg.GetID() == 47 {
	// 	Log.Info(msg.GetID())
	// 	time.Sleep(1 * time.Second)
	// }

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

	case *common.MessageBatteryStatus:
		msgName = "BATTERY_STATUS"
		data["id"] = uint64(msg.Id)
		data["temperature"] = int64(msg.Temperature)
		// data["voltages"] = msg.Voltages
		for i, voltage := range msg.Voltages {
			data[fmt.Sprintf("voltage%d", i)] = uint64(voltage)
		}
		data["current_battery"] = int64(msg.CurrentBattery)
		data["current_consumed"] = int64(msg.CurrentConsumed)
		data["energy_consumed"] = int64(msg.EnergyConsumed)
		data["battery_remaining"] = int64(msg.BatteryRemaining)
		data["time_remaining"] = int64(msg.TimeRemaining)
		data["charge_state"] = int64(msg.ChargeState)
		data["mode"] = int64(msg.Mode)
		data["fault_bitmask"] = int64(msg.FaultBitmask)

	case *common.MessageHeartbeat:
		msgName = "HEARTBEAT"

		data["type"] = msg.Type
		data["autopilot"] = msg.Autopilot
		data["base_mode"] = msg.BaseMode
		data["custom_mode"] = msg.CustomMode
		data["system_status"] = msg.SystemStatus
		data["mavlink_version"] = msg.MavlinkVersion

	// case *common.MessageHygrometerSensor:
	// 	fields := []string{"id", "temperature", "humidity"}
	// 	vals := []float64{float64(msg.Id), float64(msg.Temperature), float64(msg.Humidity)}
	// 	writeToInflux(msg.GetID(), fmt.Sprintf("HYGROMETER_SENSOR%v", msg.Id), fields, vals, writeAPI)
	// case *common.MessageEscStatus:
	// 	fields := []string{"index", "rpm", "voltage", "current"}
	// 	vals := []float64{float64(msg.Index), float64(msg.Rpm[msg.Index]), float64(msg.Humidity[ms])}
	// 	writeToInflux(msg.GetID(), "HYGROMETER_SENSOR", fields, vals, writeAPI)
	case *common.MessageNamedValueFloat:
		msgName = "NAMED_VALUE_FLOAT"

		data["time_boot_ms"] = msg.TimeBootMs
		data["name"] = msg.Name
		data["value"] = msg.Value
	}

	// If we parsed a message then write it. Otherwise it can be ignored
	if msgName != "" && len(data) != 0 {
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
func (c *Client) handleMissionUpload(evt *gomavlib.EventFrame, node *gomavlib.Node) {
	switch evt.Frame.GetMessage().(type) {
	case *common.MessageMissionAck:
		// TODO: save if mission upload suceeded/failed
	case *common.MessageMissionRequestInt:
		// TODO: send MISSION_ITEM_INT back to plane channel
	case *common.MessageMissionRequest:
		// TODO: send MISSION_ITEM back to plane channel (deprecated)
	}
}

// handleBatteryUpdate stores the most recent recorded voltage for each battery in the
// client's battery map
func (c *Client) handleBatteryUpdate(evt *gomavlib.EventFrame, node *gomavlib.Node) {
	switch msg := evt.Frame.GetMessage().(type) { //nolint: gocritic
	case *common.MessageBatteryStatus:
		if msg.BatteryRemaining != 0 { // hacky fix to wierd battery voltage behavior we're seeing
			c.LatestBatteryInfo[msg.Id] = int(msg.Voltages[0])
		}
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
func (c *Client) handleMissionDownload(evt *gomavlib.EventFrame, node *gomavlib.Node) {
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
func (c *Client) monitorMission(evt *gomavlib.EventFrame, node *gomavlib.Node) {
	switch evt.Frame.GetMessage().(type) {
	case *common.MessageMissionItemReached:
		// TODO: save to currMissionProgress
	case *common.MessageMissionCurrent:
		// TODO: save to currMission
	}
}
