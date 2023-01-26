package airdrop

/*
Stores the basic information about the intended target of each water bottle (letter, letter color, shape, shape color), as well whether it should be dropped on a manikin (IsManikin) and which slot of the airdrop mechanism it is in (DropIndex).

Example: white A on blue triangle

NOTE: might have to change this after we know exactly what houston inputs for each bottle
*/
type Bottle struct {
	Alphanumeric      string `json:"alphanumeric"`
	AlphanumericColor string `json:"alphanumeric_color"`
	Shape             string `json:"shape"`
	ShapeColor        string `json:"shape_color"`
	DropIndex         int    `json:"drop_index"`
	IsMannikin        bool   `json:"is_mannikin"`
}

/*
Stores the information about each bottle in the plane; see the Bottle struct for more detail.

We have this stored as its own struct so that we don't accidentally overwrite all the other JSON data stored in the Server struct when binding a JSON.
Rather, we bind/overwrite the JSON data in this Bottles struct, which then updates the field in the Server struct.
This way, there is no danger of overwriting anything other than the bottle drop ordering, thereby preventing the plane from blowing up :)
*/
type Bottles struct {
	Bottles []Bottle `json:"bottles"`
}