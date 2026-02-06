import React, { useEffect, useRef, useState } from "react";

import { AirdropType, GPSCoord } from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import TuasMap from "../components/TuasMap";
import { LatLng } from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import { createRandomGPSCoord, GPSCoordToString } from "../utilities/general";

const API_BASE_URL = "/api";
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
const FETCH_CLUSTERS_ENDPOINT = `${API_BASE_URL}/clusters/fetch`;
const TOGGLE_ENDPOINT = `${API_BASE_URL}/clusters/toggle`;
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
        <Marker position={new LatLng(center.Latitude, center.Longitude, center.Altitude)}>
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
          for (const d of (
            value as {
              detections: { location: GPSCoord; image: string; rejected: boolean; id: number }[];
            }
          )["detections"]) {
            const detection: Detection = {
              location: GPSCoord.create(d["location"]),
              type: +key as AirdropType,
              image: "data:image/jpeg;base64," + d["image"],
              rejected: d["rejected"],
              id: d["id"],
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
  /**
   * Updates the local state the match the proxy without pinging the obc.
   * If you want to get the runs from the obc, see updateClusters()
   */
  function syncWithoutFetchingOBC() {
    fetch(FETCH_CLUSTERS_ENDPOINT)
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
          for (const d of (
            value as {
              detections: { location: GPSCoord; image: string; rejected: boolean; id: number }[];
            }
          )["detections"]) {
            const detection: Detection = {
              location: GPSCoord.create(d["location"]),
              type: +key as AirdropType,
              image: "data:image/jpeg;base64," + d["image"],
              rejected: d["rejected"],
              id: d["id"],
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

  //These are used to update the selected cluster/detection states when new data is fetched, as the references will become invaild
  const oldSelectedCluster = useRef(-1);
  const oldSelectedDetection = useRef({ cluster: -1, id: -1 });

  /**
   * updates the value of the old... Refs so that you can call consumeOldSelected to reset the selected values to what they where before new data was fetched.
   * Otherwise, the new values will have different references, and the data will not display properly.
   */
  function updateOldSelected() {
    oldSelectedCluster.current = selectedCluster?.airdrop_type || -1;
    oldSelectedDetection.current = {
      cluster: selectedDetection?.type || -1,
      id: selectedDetection?.id || -1,
    };
  }

  useEffect(() => {
    /**
     * Should onl be called after updateOldSelected. Updates the selected... states to match the new data.
     */
    function consumeOldSelected() {
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].airdrop_type == oldSelectedCluster.current) {
          setSelectedCluster(clusters[i]);
          oldSelectedCluster.current = -1;
        }
        if (clusters[i].airdrop_type == oldSelectedDetection.current.cluster) {
          for (let j = 0; j < clusters[i].all_data_points.length; j++) {
            if (clusters[i].all_data_points[j].id == oldSelectedDetection.current.id) {
              setSelectedDetection(clusters[i].all_data_points[j]);
              oldSelectedDetection.current = { id: -1, cluster: -1 };
            }
          }
        }
      }
      if (oldSelectedCluster.current != -1 || oldSelectedDetection.current.id != -1) {
        //TODO better error handling, display error to user
        console.warn("Tried to save a selected cluster or detection that does not exists");
        oldSelectedCluster.current = -1;
        oldSelectedDetection.current = { id: -1, cluster: -1 };
      }
    }
    consumeOldSelected();
  }, [clusters]);
  /**
   * Toggles a detection's rejection status, and syncs it to the go proxy
   * This method also syncs the state of the local targets state to the proxys
   * @param id The detection to toggle
   */
  function toggleRejectionStatus(id: number) {
    updateOldSelected();
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
            {clusters.map((e) => {
              if (selectedCluster == null || selectedCluster == e) {
                return MapCluster(e);
              }
            })}
          </TuasMap>
          <div className="reports-cluster-data">
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
                        <th>Global Id</th>
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
                      toggleRejectionStatus(selectedDetection.id);
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
                  location: createRandomGPSCoord(center.Latitude, center.Longitude, 0.001, 0.001),
                  type: AirdropType.Undefined,
                  image: "",
                  rejected: false,
                  id: -1, // testing purposes only, negative ids should never exists
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
