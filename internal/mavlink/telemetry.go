package mav

type Telemetry struct {
	// Latitude of GPS position in degrees.
	// Required. [-90, 90]
	Latitude float64 `json:"latitude,omitempty"`
	// Longitude of GPS position in degrees.
	// Required. [-180, 180]
	Longitude float64 `json:"longitude,omitempty"`
	// Altitude above mean sea level (MSL) in feet.
	// Required. [-1500, 330000]
	Altitude float64 `json:"altitude,omitempty"`
	// Heading relative to true north in degrees.
	// Required. [0, 360]
	Heading float64 `json:"heading,omitempty"`
}

func ValidateTelemetry(t Telemetry) bool {
	containsData := t.Latitude != 0 || t.Longitude != 0 || t.Altitude != 0 || t.Heading != 0
	validLatLong := (-90 <= t.Latitude && t.Latitude <= 90 &&
		-180 <= t.Longitude && t.Longitude <= 180)
	validAlt := -1500 <= t.Altitude && t.Altitude <= 330000
	validHeading := 0 <= t.Heading && t.Heading <= 360
	return containsData && validLatLong && validAlt && validHeading
}
