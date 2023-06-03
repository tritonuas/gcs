package camera

type Config struct {
	Gain               float64 `json:"Gain"`
	GainAuto           string  `json:"GainAuto"`
	ExposureTime       float64 `json:"ExposureTime"`
	ExposureAuto       string  `json:"ExposureAuto"`
	WhiteBalanceAuto   string  `json:"WhiteBalanceAuto"`
	WhiteBalanceEnable bool    `json:"WhiteBalanceEnable"`
	Gamma              float64 `json:"Gamma"`
	GammaEnable        bool    `json:"GammaEnable"`
}

type Status struct {
	Connected bool `json:"connected"`
	Streaming bool `json:"streaming"`
}

type RawImage struct {
	Data      []byte
	Timestamp int64
}
