import React, { useEffect, useRef, useState } from "react";

import { AirdropType, GPSCoord } from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import TuasMap from "../components/TuasMap";
import { LatLng } from "leaflet";
import { Circle, Marker, Popup, useMapEvents } from "react-leaflet";
import { GPSCoordToString, LatLngToGPSCoord } from "../utilities/general";

const API_BASE_URL = "/api";
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
const FETCH_CLUSTERS_ENDPOINT = `${API_BASE_URL}/clusters/fetch`;
const TOGGLE_ENDPOINT = `${API_BASE_URL}/clusters/toggle`;
const DETECTION_IMAGE_ENDPOINT = `${API_BASE_URL}/clusters/detection_images`;
const CONFIRM_ENDPOINT = `${API_BASE_URL}/clusters/confirm_launch`;
const CLEAR_MANUAL_ENDPOINT = `${API_BASE_URL}/clusters/clear_manual`;
const SET_MANUAL_ENDPOINT = `${API_BASE_URL}/clusters/set_manual`;
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

/*
enum MapMode {
  FlightBound,
  SearchBound,
  MappingBound,
  Waypoint,
  InitialPath,
  SearchPath,
  DropLocation,
}
  */
//represents the data stored for a detection of a target on the OBC
interface Detection {
  // GPS cord of the detection
  location: GPSCoord;
  // Classifcation of the detection by the OBC - might be changed on client side
  type: AirdropType;
  //If this detection has been rejected
  rejected: boolean;
  //unique id for this detection
  id: number;
}
/*interface representing one cluster calculated by the airdrop */
interface Cluster {
  //The location found by the obc
  calculated_center: GPSCoord;
  //the type detected
  airdrop_type: AirdropType;
  //The data attached to this cluster, both accpted and rejected
  all_data_points: Detection[];
  //The manually selected point, if any, for the human chosen cluster center
  selected_center: GPSCoord | null;
  //Whether the intended center is the selected center or not. 
  is_manually_selected: boolean;
  //the color to draw as, stored as rgb 3-tuple
  color: number[];
}
/**
 * Gets the next color for the cluster to use
 * @param type The airdrop type
 * @returns A length 3 array with r, g, b colors
 */
function GetNextColor(type: number) {
  //If we need more, we can add them here. This maps from cv type -> color
  const colors: number[][] = [
    [0, 255, 0], // Green
    [0, 0, 255], // Blue
    [255, 255, 0], // Yellow
    [255, 0, 255], // Magenta
    [0, 255, 255], // Cyan
    [255, 128, 0], // Orange
    [128, 0, 255], // Purple
    [0, 255, 128], // Spring green
    [128, 255, 0], // Chartreuse
    [0, 128, 255], // Sky blue
  ];
  return colors[Math.min(colors.length - 1, type)];
}

// --- Component ---
const Reports: React.FC = () => {
  //const [flightMode, setFlightMode] = useState("???");
  // probably should have been a useReducer, if anyone wants to refactor
  const [clusters, setClusters] = useState([] as Cluster[]);
  const [selectedCluster, setSelectedCluster] = useState(-1);
  const [selectedDetection, setSelectedDetection] = useState(0);

  const [backgroundFetchingInterval, setBackgroundFetching] = useState(-1);
  const interval = useRef(0);
  const [fetchingMessage, setFetchingMessage] = useState("waiting to fetch");

  const selection = useRef(null as HTMLSelectElement | null);
  useEffect(() => {
    clearInterval(interval.current);
    if (backgroundFetchingInterval != -1) {
      interval.current = window.setInterval(async () => {
        setFetchingMessage("Fetching...");
        try {
          await updateClusters();
        } catch (error) {
          console.error("Caught error:", error);
          setFetchingMessage(`Error: ${error}`);
        }
        setFetchingMessage("waiting to fetch");
      }, backgroundFetchingInterval * 1000);
    }
    return () => {
      clearInterval(interval.current);
    };
  }, [backgroundFetchingInterval]);

  useEffect(() => {
    if (selection.current == null) {
      return;
    }
    selection.current.value = "" + selectedCluster;
  }, [selectedCluster]);
  /**
   * Launches the airdrops with the currently selected center
   */
  function launchAirDrops() {
    if (!window.confirm("Are you sure you want to confirm airdrops?")) {
      return;
    }
    fetch(CONFIRM_ENDPOINT, {
      method: "POST",
    })
      .catch((e) => {
        console.log("Error confirming,", e);
      })
      .then((e) => {
        console.log(e);
      });
  }
  /**
   * Gets the selected cluster, or undefined if none are selected
   * @returns The currently seleced cluster, or undefined if non are selected
   */
  function getSelectedCluster() {
    if (selectedCluster == -1) {
      return undefined;
    }
    return clusters.find((e) => {
      return e.airdrop_type == selectedCluster;
    });
  }
  /**
   * Returns all of the detections, regardless of cluster
   * @returns a list of all of the detections
   */
  function getAllDetections() {
    const out = [];
    for (const c of clusters) {
      out.push(...c.all_data_points);
    }
    return out;
  }
  /**
   * Returns a formated string of the airdrop type, or the number if it is out of range
   * @param airdrop_type The type to format
   * @returns The formatted string
   */
  function getAirdropString(airdrop_type: AirdropType) {
    return `${AirdropType[airdrop_type] ?? airdrop_type}(${airdrop_type})`;
  }

  /**
   * Gets the selected detection
   * @returns the current selected detection, or undefined if non are selected
   */
  function getSelectedDetection() {
    return clusters
      .find((c) => c.airdrop_type === selectedCluster)
      ?.all_data_points.find((d) => d.id === selectedDetection);
  }
  //Center of the map
  const [maploc, setMapLoc] = useState([51, 10] as [number, number]);
  //is currently dragging a marker
  const [dragging, setDragging] = useState(false);
  //is currently selecting markers
  const [selectMode, setselectMode] = useState(false);
  //marker to track
  const currentMarker = useRef<AirdropType | null>(null);
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

    const handleEnter = (event: { key: string }) => {
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
   * Changes cluster's selected_center to the specified coordinate, changes the specfied cluster to be manually selected, and resyncs data with the go proxy
   * @param latlng the current mouse position to set the center to
   */
  function placeMarker(latlng: LatLng) {
    if (dragging && selectMode && currentMarker.current != null) {
      setDragging(false);
      fetch(SET_MANUAL_ENDPOINT, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentMarker.current,
          center: LatLngToGPSCoord(latlng)
        })
      }).then(() => {
        currentMarker.current = null;
        setselectMode(false)
        syncWithoutFetchingOBC()
      })
    }
  }
  /**
   * triggers when marker is clicked in select mode, picks up
   * marker, sets that marker to be replaced
   * @param event marker click event
   */
  function pickMarker(type: AirdropType) {
    if (selectMode) {
      setDragging(true);
      currentMarker.current = type;
    }
  }
  /**
   * if a marker is selected, renders a marker at mouse's position
   * @returns a dummy marker at the mouse's position if a marker is being
   * replaced
   */
  const renderCurrentMarker = () => {
    if (currentMarker.current != null && dragging && selectMode) {
      return <Marker position={position} ></Marker>;
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
        placeMarker(e.latlng);
      },
      mousemove(e) {
        setPosition(e.latlng);
      },
    });
    return <>{null}</>;
  };


  /**
   * A cluster drawn on the app
   * @param cluster The cluster to draw
   * @returns the react componenent that renders
   */
  function MapCluster(cluster: Cluster) {
    function CenterMarker() {
      return <Marker
        eventHandlers={{
          click: () => {
            pickMarker(cluster.airdrop_type);
          },
        }}
        position={new LatLng(center.Latitude, center.Longitude, center.Altitude)}
      >
        <Popup>Cluster for airdrop: {AirdropType[cluster.airdrop_type]}</Popup>
      </Marker>
    }
    if (cluster.color.length <= 0) {
      cluster.color = GetNextColor(cluster.airdrop_type);
    }
    const center = (cluster.is_manually_selected ? cluster.selected_center : cluster.calculated_center) ?? cluster.calculated_center;
    return (
      <>
        {CenterMarker()}
        {cluster.all_data_points.map((e, i) => {
          return (
            <Circle
              key={i}
              eventHandlers={{
                click: () => {
                  setMapLoc([e.location.Latitude, e.location.Longitude]);
                  setSelectedCluster(e.type);
                  setSelectedDetection(e.id);
                },
              }}
              center={[e.location.Latitude, e.location.Longitude]}
              radius={e.id == selectedDetection ? 10 : 5}
              pathOptions={{
                color: e.rejected
                  ? "red"
                  : `rgb(${cluster.color[0]}, ${cluster.color[1]}, ${cluster.color[2]})`,
              }}
            />
          );
        })}


      </>
    );
  }
  /**
   * Updates the detections state with new data fetched from the backend
   */
  async function updateClusters() {
    const j = await (await fetch(TARGETS_ALL_ENDPOINT)).json();
    //Later, this would make sense to us a protobuffer for, once the format is more set
    const newval = [];
    // for now, overrid e the entire thing. Maybe latter someone can change this to only send new ones, but bandwidth isn't an issue since this should only ever happen across local points
    for (const [key, value] of Object.entries(j)) {
      const datapoints: Detection[] = [];
      for (const d of (
        value as {
          detections: { location: GPSCoord; image: string; rejected: boolean; id: number }[];
        }
      )["detections"]) {
        const detection: Detection = {
          location: GPSCoord.create(d["location"]),
          type: +key as AirdropType,
          rejected: d["rejected"],
          id: d["id"],
        };
        datapoints.push(detection);
      }
      const addition: Cluster = {
        calculated_center: (value as { center: GPSCoord })["center"],
        airdrop_type: +key as AirdropType,
        all_data_points: datapoints,
        selected_center: (value as { manual_center: GPSCoord })["manual_center"],
        is_manually_selected: (value as { is_manually_selected: boolean })["is_manually_selected"],
        color: GetNextColor(+key),
      };
      newval.push(addition);
    }
    setClusters(newval);
  }
  /**
   * Updates the local state the match the proxy without pinging the obc.
   * If you want to get the runs from the obc, see updateClusters()
   */
  async function syncWithoutFetchingOBC() {
    fetch(FETCH_CLUSTERS_ENDPOINT)
      .then((d) => {
        return d.json();
      })
      .then((j) => {
        //Later, this would make sense to us a protobuffer for, once the format is more set
        const newval = [];
        // for now, override the entire thing. Maybe latter someone can change this to only send new ones, but bandwidth isn't an issue since this should only ever happen across local points
        for (const [key, value] of Object.entries(j)) {
          const datapoints: Detection[] = [];
          for (const d of (
            value as {
              detections: { location: GPSCoord; image: string; rejected: boolean; id: number }[];
            }
          )["detections"]) {
            const detection: Detection = {
              location: GPSCoord.create(d["location"]),
              type: +key as AirdropType,
              rejected: d["rejected"],
              id: d["id"],
            };
            datapoints.push(detection);
          }
          const addition: Cluster = {
            calculated_center: (value as { center: GPSCoord })["center"],
            airdrop_type: +key as AirdropType,
            all_data_points: datapoints,
            selected_center: (value as { manual_center: GPSCoord })["manual_center"],
            is_manually_selected: (value as { is_manually_selected: boolean })["is_manually_selected"],
            color: GetNextColor(+key),
          };
          newval.push(addition);
        }
        setClusters(newval);
      });
  }

  /**
   * Toggles a detection's rejection status, and syncs it to the go proxy
   * This method also syncs the state of the local targets state to the proxys
   * @param id The detection to toggle
   */
  function toggleRejectionStatus(id: number) {
    fetch(`${TOGGLE_ENDPOINT}?id=${id}`)
      .catch(() => {
        window.alert("failed to toggle");
      })
      .then(() => {
        syncWithoutFetchingOBC();
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
              if (selectedCluster == -1 || selectedCluster == e.airdrop_type) {
                return MapCluster(e);
              }
            })}
            {renderCurrentMarker()}
          </TuasMap>
          <div className="reports-cluster-data">
            <button onClick={() => setManualVisor()}>select a marker to move</button>
            <select
              ref={selection}
              onChange={(e) => {
                setSelectedCluster(+e.target.value);
              }}
            >
              <option value={-1}>All clusters</option>
              {clusters.map((c, i) => {
                return (
                  <option
                    key={i}
                    value={c.airdrop_type}
                    style={{
                      backgroundColor: `rgb(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`,
                    }}
                  >
                    {getAirdropString(c.airdrop_type)}
                  </option>
                );
              })}
            </select>
            <div className="reports-cluster-bottom-section">
              {
                <div className="reports-cluster-container">
                  <div>
                    Airdrop {getSelectedCluster()?.airdrop_type}
                    <br></br>
                    Current Chosen Center:{" "}
                    {(() => {
                      const cluster = getSelectedCluster();
                      return cluster
                        ? GPSCoordToString((cluster.is_manually_selected ? cluster.selected_center : cluster.calculated_center))
                        : "N/A";
                    })()}
                    <br></br>
                    Calculated Center:{" "}
                    {(() => {
                      const cluster = getSelectedCluster();
                      return cluster ? GPSCoordToString(cluster.calculated_center) : "N/A";
                    })()}
                    <br></br>Using Manual Center?: {getSelectedCluster()?.is_manually_selected}
                    {getSelectedCluster()?.is_manually_selected && <button onClick={() => {
                      fetch(CLEAR_MANUAL_ENDPOINT, {
                        method: "POST",
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          id: selectedCluster
                        })
                      }).then((e) => {
                        console.log(e) //TODO remove/handle error
                      })
                    }}>Clear Manual Selection</button>}
                  </div>
                  <div className="reports-table-wrapper">
                    <table className="reports-cluster-table">
                      <thead>
                        <th>Index</th>
                        <th>Location</th>
                        <th>Global Id</th>
                        <th>Included?</th>
                      </thead>
                      <tbody className="reports-cluster-table-body">
                        {(selectedCluster == -1
                          ? getAllDetections()
                          : (getSelectedCluster()?.all_data_points ?? [])
                        ).map((p, i) => {
                          return (
                            <tr
                              key={i}
                              className="reports-cluster-table-row"
                              onClick={() => {
                                setSelectedCluster(p.type);
                                setSelectedDetection(p.id);
                                setMapLoc([p.location.Latitude, p.location.Longitude]);
                              }}
                            >
                              <td>{i}</td>
                              <td>{GPSCoordToString(p.location)}</td>
                              <td>{p.id}</td>
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
              }
            </div>
          </div>
        </div>
      </div>
      <div className="reports-col">
        <div className="reports-card report-detection-card">
          {getSelectedDetection() ? (
            <div className="report-detection-container">
              <img
                src={`${DETECTION_IMAGE_ENDPOINT}/${getSelectedDetection()?.id}`}
                className="report-detection-image"
              ></img>
              <div>
                <p>Location: {GPSCoordToString(getSelectedDetection()?.location)}</p>
                <div>
                  <button
                    onClick={() => {
                      toggleRejectionStatus(selectedDetection);
                    }}
                  >
                    {getSelectedDetection()?.rejected ? (
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
        <div className="reports-card reports-control-card">
          Controls<br></br>
          <label htmlFor="fetching-range">
            Interval (in seconds) for background fetch. Current: {backgroundFetchingInterval}{" "}
            seconds between. (-1 to disable) <br></br> {fetchingMessage}
          </label>
          <input
            name="fetching-range"
            type="range"
            className="fetching-interval-slider"
            min={-1}
            max={50}
            onChange={(e) => {
              setBackgroundFetching(+e.target.value);
            }}
          ></input>
          <br />
          <button onClick={launchAirDrops}>Confirm Launch</button>
        </div>
      </div>
    </main>
  );
};

export default Reports;
