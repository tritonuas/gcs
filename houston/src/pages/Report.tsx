import React, { useEffect, useRef, useState } from "react";

import { AirdropType, GPSCoord } from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import TuasMap from "../components/TuasMap";
import { LatLng } from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import { GPSCoordToString } from "../utilities/general";

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

<<<<<<< HEAD
  const [backgroundFetchingInterval, setBackgroundFetching] = useState(-1);
  const interval = useRef(0);
  const [fetchingMessage, setFetchingMessage] = useState("waiting to fetch");
=======
  // State for persistence flow
  const [hasLoadedInitialSavedRuns, setHasLoadedInitialSavedRuns] = useState(false);
  const [isSavingRuns, setIsSavingRuns] = useState(false);

  // --- State for manual coordinate entry ---
  const [manualAirdropTypeJson, setManualAirdropTypeJson] = useState<string>("");

  const [manualLatitude, setManualLatitude] = useState<string>("");
  const [manualLongitude, setManualLongitude] = useState<string>("");
  const [manualInputError, setManualInputError] = useState<string>("");

  // Refs
  const pollingTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingTargetsRef = useRef<boolean>(false);

  // --- Data Processing & Fetching ---

  const processFetchedRuns = useCallback(
    (fetchedRuns: IdentifiedTarget[]): boolean => {
      let newValidRunsAddedToState = false;
      const currentRunIdsInState = new Set(imageRuns.map((r) => r.runId));

      const newValidRuns = fetchedRuns.filter((run) => {
        if (seenRunIds.has(run.runId) || currentRunIdsInState.has(run.runId)) {
          return false;
        }
        const numCoords = run.coordinates?.length ?? 0;
        const numBBoxes = run.bboxes?.length ?? 0;
        const hasDetections = numCoords > 0 && numBBoxes > 0 && Math.min(numCoords, numBBoxes) > 0;

        if (!hasDetections && !seenRunIds.has(run.runId) && isMountedRef.current) {
          setSeenRunIds((prev) => new Set(prev).add(run.runId));
        }
        return hasDetections;
      });

      if (newValidRuns.length > 0) {
        newValidRunsAddedToState = true;
        if (isMountedRef.current) {
          setImageRuns((prevRuns) => {
            const updatedRuns = [...prevRuns, ...newValidRuns];
            updatedRuns.sort((a, b) => a.runId - b.runId);
            if (prevRuns.length === 0 && updatedRuns.length > 0 && currentRunIndex === 0) {
              setTimeout(() => {
                if (isMountedRef.current && currentRunIndex === 0) setCurrentRunIndex(0);
              }, 0);
            }
            return updatedRuns;
          });
          setSeenRunIds((prevIds) => {
            const u = new Set(prevIds);
            newValidRuns.forEach((r) => u.add(r.runId));
            return u;
          });
        }
      }
      return newValidRunsAddedToState;
    },
    [seenRunIds, imageRuns, currentRunIndex],
  );

  const fetchAndProcessLatest = useCallback(
    async (isInitialFetch = false) => {
      if (!isInitialFetch) {
        if (isFetchingTargetsRef.current) {
          return;
        }
        isFetchingTargetsRef.current = true;
      }

      try {
        const fetched = await fetchTargets();
        if (isMountedRef.current) {
          processFetchedRuns(fetched);
        }
        if (isMountedRef.current) setError(null);
      } catch (
        err: any // eslint-disable-line
      ) {
        if (isMountedRef.current) {
          console.error(`Fetch failed (isInitial: ${isInitialFetch}): ${err.message}`);
          if (isInitialFetch) {
            setError(`Initial fetch failed: ${err.message}`);
            setSnackbarMessage(`Error fetching new runs: ${err.message}`);
            setSnackbarOpen(true);
          }
        }
      } finally {
        if (!isInitialFetch) {
          isFetchingTargetsRef.current = false;
        }
      }
    },
    [processFetchedRuns],
  );
>>>>>>> master

  const selection = useRef(null as HTMLSelectElement | null);
  useEffect(() => {
<<<<<<< HEAD
    clearInterval(interval.current);
    if (backgroundFetchingInterval != -1) {
      interval.current = window.setInterval(async () => {
        setFetchingMessage("Fetching...");
=======
    isMountedRef.current = true;
    const loadSaved = async () => {
      try {
        const savedRuns = await fetchSavedRunsFromServer();
        if (isMountedRef.current && savedRuns.length > 0) {
          processFetchedRuns(savedRuns);
          setSnackbarMessage(`Loaded ${savedRuns.length} saved run(s).`);
          setSnackbarOpen(true);
        } else if (isMountedRef.current) {
          console.log("No saved run data found or component unmounted.");
        }
      } catch (
        loadError: any // eslint-disable-line
      ) {
        console.error("Error loading saved runs during init:", loadError);
        if (isMountedRef.current) {
          setError(`Failed to load saved run data: ${loadError.message}`);
          setSnackbarMessage(`Error loading saved runs: ${loadError.message}`);
          setSnackbarOpen(true);
        }
      } finally {
        if (isMountedRef.current) {
          setHasLoadedInitialSavedRuns(true);
        }
      }
    };
    loadSaved();
  }, [processFetchedRuns]);

  useEffect(() => {
    if (!hasLoadedInitialSavedRuns || !isMountedRef.current) {
      return;
    }

    let isCancelled = false;
    let localTimeoutId: number | null = null;

    const pollLatestRuns = async (isInitialFetch: boolean) => {
      if (!isMountedRef.current || isCancelled) {
        return;
      }

      setIsPollingUI(true);
      await fetchAndProcessLatest(isInitialFetch);

      if (isMountedRef.current && !isCancelled) {
        setIsPollingUI(false);
        localTimeoutId = window.setTimeout(() => {
          void pollLatestRuns(false);
        }, POLLING_INTERVAL_MS);
        pollingTimeoutRef.current = localTimeoutId;
      }
    };

    void pollLatestRuns(true);

    return () => {
      isCancelled = true;
      if (localTimeoutId !== null) {
        window.clearTimeout(localTimeoutId);
      }
      pollingTimeoutRef.current = null;
    };
  }, [hasLoadedInitialSavedRuns, fetchAndProcessLatest]);

  useEffect(() => {
    if (
      hasLoadedInitialSavedRuns &&
      imageRuns.length > 0 &&
      !isSavingRuns &&
      isMountedRef.current
    ) {
      const saveRuns = async () => {
        setIsSavingRuns(true);
>>>>>>> master
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
<<<<<<< HEAD
    if (selection.current == null) {
      return;
=======
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingTimeoutRef.current !== null) {
        window.clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // TODO : probably should be a button
  const handleAutofillDropLocations = () => {
    fetch("/api/mission")
      .then((res) => res.json())
      .then((mission: Mission & { DropLocation?: GPSCoord[] }) => {
        console.log("Autofilling drop locations from mission");
        const dropLocations = mission.DropLocation;

        if (dropLocations && Array.isArray(dropLocations)) {
          const newTargets: { [key in AirdropType]?: AirdropTarget } = {};
          let filledCount = 0;

          for (let i = 0; i < REQUIRED_AIRDROP_INDICES.length; i++) {
            const coord = dropLocations[i];
            if (coord) {
              newTargets[REQUIRED_AIRDROP_INDICES[i]] = AirdropTarget.create({
                Index: REQUIRED_AIRDROP_INDICES[i],
                Coordinate: coord,
              });
              filledCount++;
            }
          }
          setSubmittedTargets((prev) => ({ ...newTargets, ...prev }));
          setSnackbarMessage(`Autofilled ${filledCount} targets with coordinates from mission`);
          setSnackbarOpen(true);
        } else {
          setSnackbarMessage("No drop locations found in mission data");
          setSnackbarOpen(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching mission for autofill:", error);
        setSnackbarMessage("Error fetching mission data for autofill");
        setSnackbarOpen(true);
      });
  };

  const currentRun = useMemo(
    () =>
      imageRuns.length > 0 && currentRunIndex >= 0 && currentRunIndex < imageRuns.length
        ? imageRuns[currentRunIndex]
        : null,
    [imageRuns, currentRunIndex],
  );
  const currentDetections = useMemo((): DetectionInfo[] => {
    if (!currentRun) return [];
    const detections: DetectionInfo[] = [];
    const coords = currentRun.coordinates ?? [];
    const bboxes = currentRun.bboxes ?? [];
    const numDetections = Math.min(coords.length, bboxes.length);
    if (coords.length !== bboxes.length && numDetections > 0)
      console.warn(
        `Run ${currentRun.runId}: Coord/Bbox mismatch. Coords: ${coords.length}, BBoxes: ${bboxes.length}`,
      );
    for (let i = 0; i < numDetections; i++) {
      if (coords[i] && bboxes[i])
        detections.push({
          runId: currentRun.runId,
          detectionIndex: i,
          compositeKey: `${currentRun.runId}-${i}`,
          coordinate: coords[i],
          bbox: bboxes[i],
        });
>>>>>>> master
    }
    selection.current.value = `${AirdropType[selectedCluster] ?? selectedCluster}(${selectedCluster})`;
  }, [selectedCluster]);
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
   * Gets the selected detection
   * @returns the current selected detection, or undefined if non are selected
   */
  function getSelectedDetection() {
    return clusters
      .find((c) => c.airdrop_type === selectedCluster)
      ?.all_data_points.find((d) => d.id === selectedDetection);
  }
  const [maploc, setMapLoc] = useState([51, 10] as [number, number]);

  /**
   * A cluster drawn on the app
   * @param cluster The cluster to draw
   * @returns the react componenent that renders
   */
  function MapCluster(cluster: Cluster) {
    if (cluster.color.length <= 0) {
      cluster.color = GetNextColor(cluster.airdrop_type);
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
        <Marker
          position={new LatLng(center.Latitude ?? 0, center.Longitude ?? 0, center.Altitude ?? 0)}
        >
          <Popup>
            Cluster for airdrop: {AirdropType[cluster.airdrop_type] ?? cluster.airdrop_type}
          </Popup>
        </Marker>
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
        selected_center: null,
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
            selected_center: null,
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
            {clusters.map((e) => {
              if (selectedCluster == -1 || selectedCluster == e.airdrop_type) {
                return MapCluster(e);
              }
            })}
          </TuasMap>
          <div className="reports-cluster-data">
            <select
              ref={selection}
              onChange={(e) => {
                setSelectedCluster(+e.target.value);
              }}
            >
              <option value={-1}>All clusters</option>
              {clusters.map((c, i) => {
                if (c.all_data_points.length == 0) {
                  return;
                }
                return (
                  <option
                    key={i}
                    value={c.airdrop_type}
                    style={{
                      backgroundColor: `rgb(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`,
                    }}
                  >
                    {AirdropType[c.airdrop_type] ?? c.airdrop_type}({c.airdrop_type})
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
                        ? GPSCoordToString(cluster.selected_center ?? cluster.calculated_center)
                        : "N/A";
                    })()}
                    <br></br>
                    Calculated Center:{" "}
                    {(() => {
                      const cluster = getSelectedCluster();
                      return cluster ? GPSCoordToString(cluster.calculated_center) : "N/A";
                    })()}
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
                src={`${API_BASE_URL}/clusters/detection_images/${getSelectedDetection()?.id}`}
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
          <button onClick={updateClusters}>Fetch data</button>
        </div>
      </div>
    </main>
  );
};

export default Reports;
