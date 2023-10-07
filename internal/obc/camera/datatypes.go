package camera

// Config defines the configuration options we can change from the frontend for the camera
// on the Jetson
type Config struct {
	Gain               float64 `json:"Gain"`
	GainAuto           string  `json:"GainAuto"`
	ExposureTime       float64 `json:"ExposureTime"`
	ExposureAuto       string  `json:"ExposureAuto"`
	BalanceWhiteAuto   string  `json:"BalanceWhiteAuto"`
	BalanceWhiteEnable bool    `json:"BalanceWhiteEnable"`
	Gamma              float64 `json:"Gamma"`
	GammaEnable        bool    `json:"GammaEnable"`
}

// Status defines the status of the camera on the Jetson, whether it is physcially connected
// and whether it is currently streaming images to the frontend application
type Status struct {
	Connected bool `json:"connected"`
	Streaming bool `json:"streaming"`
}

// RawImage defines the raw image data that is sent between the frontend and backend, for pulling the
// most recent streamed image from the camera
type RawImage struct {
	Data      []byte
	Timestamp int64
}
