package computer_vision

type ODLC struct {
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Orientation string  `json:"orientation"`
	Shape       int     `json:"shape"`
	Char        string  `json:"char"`
	ShapeColor  int     `json:"shape_color"`
	CharColor   int     `json:"char_color"`
}

type Image struct {
	Filename string `json:"filename"`
	ODLCs    []ODLC `json:"targets"`
}

type ComputerVisionData struct {
	Images []Image
}

func InitializeData() *ComputerVisionData {
	data := &ComputerVisionData {
		Images: []Image{},
	}

	return data
}