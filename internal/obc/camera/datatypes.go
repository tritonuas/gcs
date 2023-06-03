package camera

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

type Status struct {
	Connected bool `json:"connected"`
	Streaming bool `json:"streaming"`
}

type RawImage struct {
	Data      []byte
	Timestamp int64
}
