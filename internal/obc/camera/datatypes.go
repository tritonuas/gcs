package camera

type Config struct {
	Gain         float64 `json:"Gain"`
	GainAuto     string  `json:"GainAuto"`
	ExposureTime float64 `json:"ExposureTime"`
	ExposureAuto string  `json:"ExposureAuto"`
}

type Status struct {
	Connected bool `json:"connected"`
	Streaming bool `json:"streaming"`
}

type RawImage struct {
	Data      []byte
	Timestamp int64
}
