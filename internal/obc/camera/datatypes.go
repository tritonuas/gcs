package camera

type Config struct {
	Gain         float64 `json:"Gain"`
	GainAuto     string  `json:"GainAuto"`
	Exposure     float64 `json:"Exposure"`
	ExposureAuto string  `json:"ExposureAuto"`
}
