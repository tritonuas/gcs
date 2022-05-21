package computer_vision

type ClassifiedODLC struct {
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Orientation string  `json:"orientation"`
	Shape       int     `json:"shape"`
	Char        string  `json:"char"`
	ShapeColor  int     `json:"shape_color"`
	CharColor   	   int     `json:"char_color"`
	CroppedImageBase64 string  `json:"cropped_image_base64"`
	CroppedFilename    string  `json:"cropped_filename"`
}

type UnclassifiedODLC struct {
	Timestamp          string  `json:"timestamp"`
	CroppedFilename    string  `json:"cropped_filename"`
	CroppedImageBase64 string  `json:"cropped_image_base64"`
	Bbox               Bbox    `json:"bbox"`
	PlaneLat           float64 `json:"plane_lat"`
	PlaneLon           float64 `json:"plane_lon"`
	PlaneAlt           float64 `json:"alt"`
}

type Bbox struct {
	X1 int `json:"x1"`
	Y1 int `json:"y1"`
	X2 int `json:"x2"`
	Y2 int `json:"y2"`
}

type ComputerVisionData struct {
	ClassifiedODLCs []ClassifiedODLC
}

func InitializeData() *ComputerVisionData {
	data := &ComputerVisionData {
		ClassifiedODLCs: []ClassifiedODLC{},
	}

	return data
}