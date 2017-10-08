package main

import (
	"math"
)

// Haversine (θ) function
func haversine(theta float64) float64 {
	return math.Pow(math.Sin(theta/2), 2)
}

// MetersToFeet Conversion from meters to feet
func metersToFeet(value float32) float32 {
	return value / float32(0.3048)
}

// GpsDistance function returns the distance (in meters) between two points of
//     a given longitude and latitude relatively accurately (using a spherical
//     approximation of the Earth) through the Haversin GpsDistance Formula for
//     great arc distance on a sphere with accuracy for small distances
//
// point coordinates are supplied in degrees and converted into rad. in the func
//
// distance returned is METERS!!!!!!
// http://en.wikipedia.org/wiki/Haversine_formula
func gpsDistanceRaw(lat1, lon1, lat2, lon2 float32) float32 {
	// convert to radians
	// must cast radius as float to multiply later
	var la1, lo1, la2, lo2, r float32
	la1 = lat1 * math.Pi / 180
	lo1 = lon1 * math.Pi / 180
	la2 = lat2 * math.Pi / 180
	lo2 = lon2 * math.Pi / 180

	r = 6378100 // Earth radius in METERS

	// calculate
	h := haversine(float64(la2-la1)) + math.Cos(float64(la1))*math.Cos(float64(la2))*haversine(float64(lo2-lo1))

	return 2 * r * float32(math.Asin(math.Sqrt(h)))
}

// WaypointDistance Calculates distance between lat, lon, alt pairs
func waypointDistanceRaw(lat1, lon1, alt1, lat2, lon2, alt2 float32) float32 {
	// meters
	gpsDist := gpsDistanceRaw(lat1, lon1, lat2, lon2)
	gpsDistFt := metersToFeet(gpsDist)
	AltDistFt := math.Abs(float64(alt1 - alt2))
	return float32(math.Hypot(float64(gpsDistFt), AltDistFt))
}

func GpsDistance(gps1, gps2 IGps) float32 {
	return gpsDistanceRaw(gps1.GetLatitude(), gps1.GetLongitude(), gps2.GetLatitude(), gps2.GetLongitude())
}

func WaypointDistance(wp1, wp2 IWaypoint) float32 {
	return waypointDistanceRaw(wp1.GetLatitude(), wp1.GetLongitude(), wp1.GetAltitudeMsl(), wp2.GetLatitude(), wp2.GetLongitude(), wp2.GetAltitudeMsl())
}

// IWaypoint waypoint interface
type IWaypoint interface {
	GetLongitude() float32
	GetLatitude() float32
	GetAltitudeMsl() float32
}

// IGps gps interface
type IGps interface {
	GetLongitude() float32
	GetLatitude() float32
}
