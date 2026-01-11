import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

import {
  IdentifiedTarget,
  AirdropType,
  airdropTypeToJSON,
  airdropTypeFromJSON,
  GPSCoord,
  BboxProto,
  AirdropTarget,
  Mission,
} from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import { AddIcCall, Cancel, CheckCircle } from "@mui/icons-material";
import TuasMap from "../components/TuasMap";
import { LatLng, latLng, map } from "leaflet";
import { Circle, Marker, Polygon, Popup, SVGOverlay } from "react-leaflet";
import { createRandomGPSCoord, GPSCoordToString } from "../utilities/general";

// --- Constants ---
const POLLING_INTERVAL_MS = 10000;
const API_BASE_URL = "/api";
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
const TARGET_MATCHED_ENDPOINT = `${API_BASE_URL}/targets/matched`;
const SAVE_LOAD_REPORT_ENDPOINT = `${API_BASE_URL}/report`;
const REQUIRED_AIRDROP_INDICES = Object.values(AirdropType).filter(
  (v) => typeof v === "number" && v !== AirdropType.UNRECOGNIZED && v !== AirdropType.Undefined,
) as AirdropType[];

// --- Helper Functions ---
const fetchTargets = async (): Promise<IdentifiedTarget[]> => {
  try {
    const response = await fetch(TARGETS_ALL_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid data format from /targets/all");
    return data.map((item) => IdentifiedTarget.fromJSON(item));
  } catch (error) {
    console.error("Error fetching targets from /targets/all:", error);
    throw error;
  }
};

const postMatchedTargets = async (payload: AirdropTarget[]): Promise<boolean> => {
  console.log(`POSTING FINAL MATCHES to ${TARGET_MATCHED_ENDPOINT}:`, payload);
  const jsonPayload = payload.map((target) => AirdropTarget.toJSON(target));
  try {
    const response = await fetch(TARGET_MATCHED_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonPayload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `POST to ${TARGET_MATCHED_ENDPOINT} failed with status ${response.status}`,
        errorBody,
      );
      if (response.status === 404) {
        throw new Error(
          `Endpoint not found (${response.status}): POST ${TARGET_MATCHED_ENDPOINT}. Check backend route and dev proxy.`,
        );
      } else {
        throw new Error(`HTTP ${response.status} - ${errorBody || response.statusText}`);
      }
    }
    console.log("POST successful:", jsonPayload);
    return true;
  } catch (error) {
    console.error("Error posting final matched targets:", error);
    throw error;
  }
};

// New helper to fetch saved runs
const fetchSavedRunsFromServer = async (): Promise<IdentifiedTarget[]> => {
  try {
    const response = await fetch(SAVE_LOAD_REPORT_ENDPOINT);
    if (!response.ok) {
      if (response.status === 404) {
        console.log("No saved runs found on server (404).");
        return [];
      }
      throw new Error(`HTTP ${response.status} fetching saved runs`);
    }
    const text = await response.text();
    if (!text) {
      console.log("Received empty response body from saved runs endpoint.");
      return [];
    }
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      if (typeof data === "object" && Object.keys(data).length === 0) {
        console.warn(
          "Saved runs endpoint returned an empty object, expected array. Treating as no runs.",
        );
        return [];
      }
      throw new Error("Invalid data format for saved runs (expected array)");
    }
    return data.map((item) => IdentifiedTarget.fromJSON(item));
  } catch (error) {
    console.error("Error fetching saved runs:", error);
    return [];
  }
};

// New helper to push runs to be saved
const pushSavedRunsToServer = async (runsToSave: IdentifiedTarget[]): Promise<boolean> => {
  console.log(`Pushing ${runsToSave.length} runs to ${SAVE_LOAD_REPORT_ENDPOINT}`);
  const jsonPayload = runsToSave.map((run) => IdentifiedTarget.toJSON(run));
  try {
    const response = await fetch(SAVE_LOAD_REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonPayload),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status} pushing saved runs - ${errorBody || response.statusText}`,
      );
    }
    return true;
  } catch (error) {
    console.error("Error pushing saved runs:", error);
    throw error;
  }
};

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
  const [flightMode, setFlightMode] = useState("???");
  // probably should have been a useReducer, if anyone wants to refactor
  const [clusters, setClusters] = useState([] as Cluster[]);
  const [selectedCluster, setSelectedCluster] = useState(null as Cluster | null);
  const [selectedDetection, setSelectedDetection] = useState(null as Detection | null);
  const [maploc, setMapLoc] = useState([51, 10] as [number, number]);

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
              radius={e == selectedDetection ? 200 : 100}
              pathOptions={{
                color: e.rejected
                  ? "red"
                  : `rgb(${cluster.color[0]}, ${cluster.color[1]}, ${cluster.color[2]})`,
              }}
            />
          );
        })}
        <Marker position={new LatLng(center.Latitude, center.Longitude, center.Altitude)}>
          <Popup>Cluster for airdrop: {cluster.airdrop_type}</Popup>
        </Marker>
      </>
    );
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
                    {c.airdrop_type}
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
          <button
            onClick={() => {
              const center = GPSCoord.create({
                Latitude: maploc[0] + Math.random() * 0.02 - 0.01,
                Longitude: maploc[1] + Math.random() * 0.02 - 0.01,
                Altitude: 0,
              });

              const addition: Cluster = {
                calculated_center: center,
                airdrop_type: AirdropType.Beacon,
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
          <button
            onClick={() => {
              if (!window.confirm("This will wipe all cluster data! Are you sure?")) {
                return;
              }
              setClusters([]);
            }}
          >
            Clear local cluster storage
          </button>
        </div>
      </div>
    </main>
  );
};

export default Reports;
