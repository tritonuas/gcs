<<<<<<< HEAD
<<<<<<< HEAD
import React, { useState } from "react";
=======
import React, { useState, useEffect, useRef, cloneElement, SetStateAction, useId } from "react";
>>>>>>> e6ccbd5 (add change centers)
=======
import React, { useState, useEffect, useRef } from "react";
>>>>>>> 1065861 (test)

import { AirdropType, GPSCoord } from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import TuasMap from "../components/TuasMap";
<<<<<<< HEAD
<<<<<<< HEAD
import { LatLng } from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import { createRandomGPSCoord, GPSCoordToString } from "../utilities/general";

const API_BASE_URL = "/api";
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
=======
import { latLng, LatLng, marker } from "leaflet";
import { Circle, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import { createRandomGPSCoord, GPSCoordToString } from "../utilities/general";
import L from "leaflet";
import { Mouse } from "@mui/icons-material";
>>>>>>> e6ccbd5 (add change centers)
=======
import { LatLng } from "leaflet";
import { Circle, Marker, Popup, useMapEvents } from "react-leaflet";
import { createRandomGPSCoord, GPSCoordToString } from "../utilities/general";
>>>>>>> 1065861 (test)
// --- Constants ---
// const POLLING_INTERVAL_MS = 10000;
// const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
// const TARGET_MATCHED_ENDPOINT = `${API_BASE_URL}/targets/matched`;
// const SAVE_LOAD_REPORT_ENDPOINT = `${API_BASE_URL}/report`;
// const REQUIRED_AIRDROP_INDICES = Object.values(AirdropType).filter(
//   (v) => typeof v === "number" && v !== AirdropType.UNRECOGNIZED && v !== AirdropType.Undefined,
// ) as AirdropType[];

// New helper to fetch saved runs
// const fetchSavedRunsFromServer = async (): Promise<IdentifiedTarget[]> => {
//   try {
//     const response = await fetch(SAVE_LOAD_REPORT_ENDPOINT);
//     if (!response.ok) {
//       if (response.status === 404) {
//         console.log("No saved runs found on server (404).");
//         return [];
//       }
//       throw new Error(`HTTP ${response.status} fetching saved runs`);
//     }
//     const text = await response.text();
//     if (!text) {
//       console.log("Received empty response body from saved runs endpoint.");
//       return [];
//     }
//     const data = JSON.parse(text);

//     if (!Array.isArray(data)) {
//       if (typeof data === "object" && Object.keys(data).length === 0) {
//         console.warn(
//           "Saved runs endpoint returned an empty object, expected array. Treating as no runs.",
//         );
//         return [];
//       }
//       throw new Error("Invalid data format for saved runs (expected array)");
//     }
//     return data.map((item) => IdentifiedTarget.fromJSON(item));
//   } catch (error) {
//     console.error("Error fetching saved runs:", error);
//     return [];
//   }
// };
<<<<<<< HEAD
<<<<<<< HEAD

=======
=======
/*
>>>>>>> 1065861 (test)
enum MapMode {
  FlightBound,
  SearchBound,
  MappingBound,
  Waypoint,
  InitialPath,
  SearchPath,
  DropLocation,
}
<<<<<<< HEAD
>>>>>>> e6ccbd5 (add change centers)
=======
  */
>>>>>>> 1065861 (test)
//represents the data stored for a detection of a target on the OBC
interface Detection {
  // GPS cord of the detection
  location: GPSCoord;
  // Classifcation of the detection by the OBC - might be changed on client side
  type: AirdropType;
  //Base 64 image TODO - does this include the base64: start
  image: string;
  //If this detection has been rejected
  rejected: boolean;
}
/*interface representing one cluster calculated by the airdrop */
interface Cluster {
  //The location found by the obc
  calculated_center: GPSCoord;
  //the type detected
  airdrop_type: AirdropType;
  //The data attached to this cluster, both accpted and rejected
  all_data_points: Detection[];
  //The manually selected point, if any, for the true cluster center
  selected_center: GPSCoord | null;
  //the color to draw as, stored as rgb 3-tuple
  color: number[];
}
//TODO make better
/**
 * Gets the next color for the cluster to use
 * @returns A length 3 array with r, g, b colors
 */
function GetNextColor() {
  return [(Math.random() * 255) % 255, (Math.random() * 255) % 255, (Math.random() * 255) % 255];
}
// --- Component ---
const Reports: React.FC = () => {
  //const [flightMode, setFlightMode] = useState("???");
  // probably should have been a useReducer, if anyone wants to refactor
  const [clusters, setClusters] = useState([] as Cluster[]);
  const [selectedCluster, setSelectedCluster] = useState(null as Cluster | null);
  const [selectedDetection, setSelectedDetection] = useState(null as Detection | null);
  const [maploc, setMapLoc] = useState([51, 10] as [number, number]);
<<<<<<< HEAD
=======
  const isMounted = useRef(false);
  //persistance
  useEffect(() => {
    const old = localStorage.getItem("saved-cluster");
    if (old != null) {
      setClusters(JSON.parse(old));
    }
  }, []);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    console.log("Saving new cluster data", clusters);
    try {
      localStorage.setItem("saved-cluster", JSON.stringify(clusters));
    } catch (e) {
      window.alert("Issue with saving locally, latest changes not updated ");
    }
  }, [clusters]);

  //is currently dragging a marker
  const [dragging, setDragging] = useState(false);
  //is currently selecting markers
  const [selectMode, setselectMode] = useState(false);
  //marker to track
  const currentMarker = useRef(null);
  //position of mouse
  const [position, setPosition] = useState(new LatLng(0, 0, 0));

  //enter handler
  useEffect(() => {
    /**
     * resets to default mode, drops current marker
     */
    function unplaceMarker() {
      if (selectMode) {
        setselectMode(false);
        setDragging(false);
      }
    }

    const handleEnter = (event) => {
      if (selectMode && currentMarker.current != null && dragging && event.key == "Enter") {
        unplaceMarker();
      }
    };
    window.addEventListener("keydown", handleEnter);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("keydown", handleEnter);
    };
  }, [selectMode, currentMarker, dragging]); // Empty dependency array ensures this runs once on mount

  /**
   * triggers when 'change centers' button is clicked, sets select mode to on
   */
  function setManualVisor() {
    setselectMode(!selectMode);
  }
  /**
   * changes cluster center to the specified coordinate
   * @param latlng the current mouse position to set the center to
   */
  function placeMarker(latlng: LatLng) {
    if (dragging && selectMode && currentMarker.current != null) {
      setDragging(false);
      console.log(currentMarker.current);
      const updateClusters = clusters.map((e) => {
        const center = e.selected_center ?? e.calculated_center;
        if (
          currentMarker.current._latlng.equals(
            new LatLng(center.Latitude, center.Longitude, center.Altitude),
          )
        ) {
          const replacement: Cluster = {
            calculated_center: center,
            airdrop_type: e.airdrop_type,
            all_data_points: e.all_data_points,
            selected_center: GPSCoord.create({
              Latitude: latlng.latlng.lat,
              Longitude: latlng.latlng.lng,
              Altitude: 0,
            }),
            color: e.color,
          };
          console.log("artillery");
          return replacement;
        } else {
          return e;
        }
      });
      setClusters(updateClusters);
    }
  }
  /**
   * triggers when marker is clicked in select mode, picks up
   * marker, sets that marker to be replaced
   * @param event marker click event
   */
  function pickMarker(event) {
    if (selectMode) {
      setDragging(true);
      currentMarker.current = event.target;
    }
  }
  /**
   * if a marker is selected, renders a marker at mouse's position
   * @returns a dummy marker at the mouse's position if a marker is being
   * replaced
   */
  const renderCurrentMarker = () => {
    if (currentMarker.current != null && dragging && selectMode) {
      return <Marker position={position}></Marker>;
    }
  };
  /**
   * handles map events like clicking, which changes the center; and mousemove,
   * which renders the dummy marker
   * @returns nothing
   */
  const MapOnClickHandler = () => {
    useMapEvents({
      click: (e) => {
        const wrapper = {
          latlng: e.latlng,
        };
        placeMarker(wrapper);
      },
      mousemove(e) {
        setPosition(e.latlng);
      },
    });
    return <>{null}</>;
  };
>>>>>>> e6ccbd5 (add change centers)

  /**
   * A cluster drawn on the app
   * @param cluster The cluster to draw
   * @returns the react componenent that renders
   */
  function MapCluster(cluster: Cluster) {
    if (cluster.color.length <= 0) {
      cluster.color = GetNextColor();
    }
    const center = cluster.selected_center ?? cluster.calculated_center;
    return (
      <>
        {cluster.all_data_points.map((e, i) => {
          return (
            <Circle
              key={i}
              eventHandlers={{
                click: () => {
                  setMapLoc([e.location.Latitude, e.location.Longitude]);
                  setSelectedDetection(e);
                },
              }}
              center={[e.location.Latitude, e.location.Longitude]}
              radius={e == selectedDetection ? 10 : 5}
              pathOptions={{
                color: e.rejected
                  ? "red"
                  : `rgb(${cluster.color[0]}, ${cluster.color[1]}, ${cluster.color[2]})`,
              }}
            />
          );
        })}
        <Marker
          eventHandlers={{
            click: (e) => {
              pickMarker(e);
            },
          }}
          position={new LatLng(center.Latitude, center.Longitude, center.Altitude)}
        >
          <Popup>Cluster for airdrop: {AirdropType[cluster.airdrop_type]}</Popup>
        </Marker>
      </>
    );
  }
  /**
   * Updates the detections state with new data fetched from the backend
   */
  function updateClusters() {
    fetch(TARGETS_ALL_ENDPOINT)
      .then((d) => {
        return d.json();
      })
      .then((j) => {
        console.log("Data obtained from go proxy:", j);
        //Later, this would make sense to us a protobuffer for, once the format is more set
        const newval = [];
        // for now, overrid e the entire thing. Maybe latter someone can change this to only send new ones, but bandwidth isn't an issue since this should only ever happen across local points
        for (const [key, value] of Object.entries(j)) {
          const datapoints: Detection[] = [];
          for (const d of (value as { detections: { location: GPSCoord; Image: string }[] })[
            "detections"
          ]) {
            const detection: Detection = {
              location: GPSCoord.create(d["location"]),
              type: +key as AirdropType,
              image: "data:image/jpeg;base64," + d["Image"],
              rejected: false,
            };
            datapoints.push(detection);
          }
          const addition: Cluster = {
            calculated_center: (value as { center: GPSCoord })["center"],
            airdrop_type: +key as AirdropType,
            all_data_points: datapoints,
            selected_center: null,
            color: GetNextColor(),
          };
          newval.push(addition);
        }
        setClusters(newval);
      });
  }

  return (
    <main className="reports-main">
      <div className="reports-col">
        <div className="reports-card">
          <TuasMap className={"reports-map"} lat={51} lng={10}>
            <UpdateMapCenter position={maploc} />
            <MapOnClickHandler />
            {clusters.map((e) => {
              if (selectedCluster == null || selectedCluster == e) {
                return MapCluster(e);
              }
            })}
            {renderCurrentMarker()}
          </TuasMap>
          <div className="reports-cluster-data">
            <button onClick={() => setManualVisor()}>select a marker to move</button>
            <button>{selectMode && <p>hello</p>}</button>
            <select>
              <option
                onClick={() => {
                  setSelectedCluster(null);
                }}
              >
                All clusters
              </option>
              {clusters.map((c, i) => {
                return (
                  <option
                    key={i}
                    style={{
                      backgroundColor: `rgb(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`,
                    }}
                    onClick={() => {
                      setSelectedCluster(c);
                    }}
                  >
                    {AirdropType[c.airdrop_type] ?? c.airdrop_type}({c.airdrop_type})
                  </option>
                );
              })}
            </select>
            <div className="reports-cluster-bottom-section">
              {selectedCluster && (
                <div className="reports-cluster-container">
                  <div>
                    Airdrop {selectedCluster?.airdrop_type}
                    <br></br>
                    Current Chosen Center:{" "}
                    {selectedCluster &&
                      GPSCoordToString(
                        selectedCluster.selected_center ?? selectedCluster.calculated_center,
                      )}
                    <br></br>
                    Calculated Center:{" "}
                    {selectedCluster && GPSCoordToString(selectedCluster.calculated_center)}
                  </div>
                  <div className="reports-table-wrapper">
                    <table className="reports-cluster-table">
                      <thead>
                        <th>Index</th>
                        <th>Location</th>
                        <th>Included?</th>
                      </thead>
                      <tbody className="reports-cluster-table-body">
                        {selectedCluster.all_data_points.map((p, i) => {
                          return (
                            <tr
                              key={i}
                              className="reports-cluster-table-row"
                              onClick={() => {
                                setSelectedDetection(p);
                                setMapLoc([p.location.Latitude, p.location.Longitude]);
                              }}
                            >
                              <td>{i}</td>
                              <td>{GPSCoordToString(p.location)}</td>
                              <td>
                                {p.rejected ? (
                                  <span style={{ color: "red" }}>False</span>
                                ) : (
                                  <span style={{ color: "green" }}>True</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="reports-col">
        <div className="reports-card report-detection-card">
          {selectedDetection ? (
            <div className="report-detection-container">
              <img src={selectedDetection.image} className="report-detection-image"></img>
              <div>
                <p>Location: {GPSCoordToString(selectedDetection.location)}</p>
                <div>
                  <button
                    onClick={() => {
                      //ugly way to update this, but I'm not sure a better way to handle it without needing a bunch of back references from detection to cluster
                      for (const c of clusters) {
                        for (const detection of c.all_data_points) {
                          if (detection == selectedDetection) {
                            detection.rejected = !detection.rejected;
                          }
                        }
                      }
                      setClusters([...clusters]);
                    }}
                  >
                    {selectedDetection.rejected ? (
                      <span style={{ color: "green" }}>Re-accept point</span>
                    ) : (
                      <span style={{ color: "red" }}>Reject Point</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <h1>Select a detection on the map or from the table to view</h1>
          )}
        </div>
        <div className="reports-card">
          Temp dev stuff idk what goes here yets <br></br>
          <button onClick={updateClusters}>Fetch data</button>
          <button
            onClick={() => {
              const center = GPSCoord.create({
                Latitude: maploc[0] + Math.random() * 0.002 - 0.001,
                Longitude: maploc[1] + Math.random() * 0.002 - 0.001,
                Altitude: 0,
              });

              const addition: Cluster = {
                calculated_center: center,
                airdrop_type: AirdropType.Water,
                all_data_points: [],
                selected_center: null,
                color: [],
              };
              for (let i = 0; i < 20; i++) {
                addition.all_data_points.push({
                  location: createRandomGPSCoord(center.Latitude, center.Longitude, 0.01, 0.01),
                  type: AirdropType.Undefined,
                  image: "",
                  rejected: false,
                });
              }
              setClusters([...clusters, addition]);
            }}
          >
            Add random cluster
          </button>
        </div>
      </div>
    </main>
  );
};

export default Reports;
