import L, { LatLng } from "leaflet";
import { useEffect, useState } from "react";
import { Marker, Polygon } from "react-leaflet";
import React from "react";

/**
 * Props for the flight bounds components
 */
interface FlightBoundsProps {
  /**
   * If the waypoints should be rendered
   * true will cause rendering
   */
  Waypoints?: boolean;
  /**
   * If the flight bounds should be rendered
   * true will cause rendering
   */
  FlightBounds?: boolean;
  /**
   * If the search bounds should be rendered
   * true will cause rendering
   */
  SearchBounds?: boolean;
}
/**
 * Should only be used as a child of a TuasMap component
 * Renders the flight/search bounds and waypoints based on the values provided in props
 * @param props Props for this component, to set which bounds to render
 * @returns The polygon components to render the bounds
 */
export default function FlightBounds(props: FlightBoundsProps) {
  const [flightBound, setFlightBound] = useState<LatLng[]>([]);
  const [searchBound, setSearchBound] = useState<LatLng[]>([]);
  const [wayPoint, setWayPoint] = useState<LatLng[]>([]);
  useEffect(() => {
    /**
     * A helper functions that extracts out the get request and updates of flight bounds.
     * @param setFlightBound React state setter for Flight Bound variable.
     * @param setSearchBound React state setter for Search Bound variable.
     * @param setWayPoint React state setter for Way Point variable.
     */
    function pullFlightBounds(
      setFlightBound: React.Dispatch<React.SetStateAction<LatLng[]>>,
      setSearchBound: React.Dispatch<React.SetStateAction<LatLng[]>>,
      setWayPoint: React.Dispatch<React.SetStateAction<LatLng[]>>,
    ) {
      fetch("/api/mission", {
        method: "GET",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Connecting");
          } else {
            return response.json();
          }
        })
        .then((data) => {
          if (Object.prototype.hasOwnProperty.call(data, "FlightBoundary")) {
            data["FlightBoundary"].map((coordinates: { Latitude: number; Longitude: number }) => {
              updateCoordinate(setFlightBound, [coordinates["Latitude"], coordinates["Longitude"]]);
            });
          }
          if (Object.prototype.hasOwnProperty.call(data, "AirdropBoundary")) {
            data["AirdropBoundary"].map((coordinates: { Latitude: number; Longitude: number }) => {
              updateCoordinate(setSearchBound, [coordinates["Latitude"], coordinates["Longitude"]]);
            });
          } //new
          if (Object.prototype.hasOwnProperty.call(data, "Waypoints")) {
            data["Waypoints"].map((coordinates: { Latitude: number; Longitude: number }) => {
              updateCoordinate(setWayPoint, [coordinates["Latitude"], coordinates["Longitude"]]);
            });
          }
        })
        .catch((error) => {
          console.error("Fetch error:", error);
        });
    }

    pullFlightBounds(setFlightBound, setSearchBound, setWayPoint);
  }, []);
  /**
   * A helper function to help with pushing an elemet to the end of an array of LatLng values.
   * @param setCoordinates React state setter for coordinates array.
   * @param planeLatLng A pair of LatLng coordiantes.
   */
  function updateCoordinate(
    setCoordinates: React.Dispatch<React.SetStateAction<LatLng[]>>,
    planeLatLng: [number, number],
  ) {
    setCoordinates((coordinates) => [...coordinates, new LatLng(planeLatLng[0], planeLatLng[1])]);
  }

  return (
    <>
      {props.FlightBounds && <Polygon color="red" positions={flightBound} />}
      {props.SearchBounds && <Polygon color="blue" positions={searchBound} />}
      {props.Waypoints &&
        wayPoint.map((latlng, index) => {
          return (
            <Marker
              key={index}
              position={latlng}
              icon={
                new L.DivIcon({
                  className: "custom-div-icon",
                  html:
                    "<div style='background-color:yellow;' class='marker-pin' data-content='" +
                    (index + 1) +
                    "'></div>",
                  iconSize: [30, 42],
                  iconAnchor: [15, 42],
                })
              }
            />
          );
        })}
    </>
  );
}
