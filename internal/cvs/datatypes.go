package cvs

// ClassifiedODLC represents a target and its characteristics that are predicted by the Computer Vision pipeline.
// This data will be provided by the Computer Vision Server.
type ClassifiedODLC struct {
	Latitude           float64 `json:"latitude"`
	Longitude          float64 `json:"longitude"`
	Shape              int     `json:"shape"`
	Char               string  `json:"char"`
	ShapeColor         int     `json:"shape_color"`
	CharColor          int     `json:"char_color"`
	CroppedImageBase64 string  `json:"cropped_image_base64"`
	CroppedFilename    string  `json:"cropped_filename"`
	DropIndex          int     `json:"drop_index"`
}

// UnclassifiedODLC represents the target right after it has been cropped.
// At this stage we have no classification data about the targets, aside
// from if they are a mannequin or not.
// This data is provded by the Jetson.
type UnclassifiedODLC struct {
	Timestamp          string  `json:"timestamp"`
	CroppedFilename    string  `json:"cropped_filename"`
	CroppedImageBase64 string  `json:"cropped_image_base64"`
	Bbox               Bbox    `json:"bbox"`
	PlaneLat           float64 `json:"plane_lat"`
	PlaneLon           float64 `json:"plane_lon"`
	PlaneAlt           float64 `json:"alt"`
	PlaneHead          float64 `json:"head"`
	Mannequin          bool    `json:"mannequin"`
}

// Bbox is a bounding box drawn around a target in the full-resolution aerial image.
// This data will be provided by the Jetson in the saliency stage of the CV pipeline.
type Bbox struct {
	X1 int `json:"x1"`
	Y1 int `json:"y1"`
	X2 int `json:"x2"`
	Y2 int `json:"y2"`
}

// Data aggregates all Computer Vision data that the Hub stores.
type Data struct {
	ClassifiedODLCs []ClassifiedODLC
}
