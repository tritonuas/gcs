import React, { useCallback, useEffect, useRef, useState } from "react";

import { AirdropType, GPSCoord } from "../protos/obc.pb";

import UpdateMapCenter from "../components/UpdateMapCenter";
import "./Report.css";
import TuasMap from "../components/TuasMap";
import { LatLng, Icon } from "leaflet";
import { Circle, Marker, Popup, useMapEvents } from "react-leaflet";
import { GPSCoordToString, LatLngToGPSCoord } from "../utilities/general";
import FlightBounds from "../components/FlightBounds";
import Crosshair from "../assets/crosshair.svg";
const API_BASE_URL = "/api";
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
const FETCH_CLUSTERS_ENDPOINT = `${API_BASE_URL}/clusters/fetch`;
const TOGGLE_ENDPOINT = `${API_BASE_URL}/clusters/toggle`;
const DETECTION_IMAGE_ENDPOINT = `${API_BASE_URL}/clusters/detection_images`;
const CONFIRM_ENDPOINT = `${API_BASE_URL}/clusters/confirm_launch`;
const CLEAR_MANUAL_ENDPOINT = `${API_BASE_URL}/clusters/clear_manual`;
const SET_MANUAL_ENDPOINT = `${API_BASE_URL}/clusters/set_manual`;

type DetectionSortField = "type" | "rejected" | "id";
type SortDirection = "ascending" | "descending";

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
const crosshair = new Icon({
  iconUrl: Crosshair,
  iconSize: [32, 32],
  iconAnchor: [16, 16], // use center of icon to point
});
// --- Component ---
const Reports: React.FC = () => {
  //const [flightMode, setFlightMode] = useState("???");
  // probably should have been a useReducer, if anyone wants to refactor
  const [clusters, setClusters] = useState([] as Cluster[]);
  const [selectedCluster, setSelectedCluster] = useState(-1);
  const [selectedDetection, setSelectedDetection] = useState(0);
  const [columnSplit, setColumnSplit] = useState(0.5);
  const [leftPanelSplit, setLeftPanelSplit] = useState(0.6);
  const [rightPanelSplit, setRightPanelSplit] = useState(0.5);
  const [sort, setSort] = useState<{
    field: DetectionSortField;
    direction: SortDirection;
  }>({ field: "id", direction: "ascending" });
  const reportsRef = useRef<HTMLElement | null>(null);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);


  /**
   * Captures the pointer so a divider continues tracking outside its handle.
   * @param event The pointer event from the divider
   */
  function beginResize(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  /**
   * Updates a panel split from pointer movement, keeping both panels usable.
   * @param event The pointer movement event from the divider
   * @param container The resized container
   * @param setSplit The state updater for the panel split
   * @param axis The pointer axis used to calculate the split
   */
  function resizeSplit(
    event: React.PointerEvent<HTMLDivElement>,
    container: HTMLElement | null,
    setSplit: React.Dispatch<React.SetStateAction<number>>,
    axis: "x" | "y",
  ) {
    if (event.buttons !== 1 || !container) {
      return;
    }
    const bounds = container.getBoundingClientRect();
    const position = axis === "x" ? event.clientX - bounds.left : event.clientY - bounds.top;
    const size = axis === "x" ? bounds.width : bounds.height;
    const split = Math.min(0.8, Math.max(0.2, position / size));
    setSplit(split);
  }

  const [backgroundFetchingInterval, setBackgroundFetching] = useState(-1);
  const interval = useRef(0);
  const [fetchingMessage, setFetchingMessage] = useState("waiting to fetch");

  const fetchInterval = useCallback(async () => {
    clearInterval(interval.current);
    setFetchingMessage("Fetching...");
    try {
      await updateClusters();
    } catch (error) {
      console.error("Caught error:", error);
      setFetchingMessage(`Error: ${error}`);
      interval.current = window.setTimeout(fetchInterval, backgroundFetchingInterval * 1000);
      return;
    }
    setFetchingMessage("Waiting to fetch")
    interval.current = window.setTimeout(fetchInterval, backgroundFetchingInterval * 1000);
  }, [backgroundFetchingInterval]);
  const selection = useRef(null as HTMLSelectElement | null);
  useEffect(() => {
    clearTimeout(interval.current);
    setFetchingMessage("waiting to fetch");
    if (backgroundFetchingInterval != -1) {
      interval.current = window.setTimeout(fetchInterval, backgroundFetchingInterval * 1000);
    }
  }, [backgroundFetchingInterval, fetchInterval]);

  useEffect(() => {
    if (selection.current == null) {
      return;
    }
    selection.current.value = "" + selectedCluster;
  }, [selectedCluster]);
  useEffect(() => {
    syncWithoutFetchingOBC();
    return () => {
      clearTimeout(interval.current);
    };
  }, []);
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
   * Returns detections sorted by the selected table field.
   * @returns A sorted copy of the detections
   */
  function getSortedDetections() {
    const direction = sort.direction === "ascending" ? 1 : -1;
    return getAllDetections().sort((a, b) => {
      const comparison =
        sort.field === "rejected"
          ? Number(a.rejected) - Number(b.rejected)
          : a[sort.field] - b[sort.field];
      return direction * comparison;
    });
  }
  /**
   * Sorts a table column, toggling direction when it is already active.
   * @param field The detection field to sort by
   */
  function toggleSort(field: DetectionSortField) {
    setSort((current) => ({
      field,
      direction:
        current.field === field && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: currentMarker.current,
          center: LatLngToGPSCoord(latlng),
        }),
      }).then(() => {
        currentMarker.current = null;
        setselectMode(false);
        syncWithoutFetchingOBC();
      });
    }
  }
  /**
   * triggers when marker is clicked in select mode, picks up
   * marker, sets that marker to be replaced
   * @param type Which airdrop type's center to select
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
      return <Marker position={position} icon={crosshair}></Marker>;
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
    /**
     * Marks the center of a cluster
     * @returns A jsx fragment with a marker element
     */
    function CenterMarker() {
      return (
        <Marker
          eventHandlers={{
            click: () => {
              pickMarker(cluster.airdrop_type);
            },
          }}
          icon={crosshair}
          position={new LatLng(center.Latitude ?? 0, center.Longitude ?? 0, center.Altitude ?? 0)}
        >
          <Popup>Cluster for airdrop: {AirdropType[cluster.airdrop_type]}</Popup>
        </Marker>
      );
    }
    if (cluster.color.length <= 0) {
      cluster.color = GetNextColor(cluster.airdrop_type);
    }
    const center =
      (cluster.is_manually_selected ? cluster.selected_center : cluster.calculated_center) ??
      cluster.calculated_center;
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
                opacity:
                  selectedCluster == -1 || selectedCluster === cluster.airdrop_type ? 1 : 0.25,
                fillOpacity:
                  selectedCluster == -1 || selectedCluster === cluster.airdrop_type ? 0.5 : 0.1,
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
            is_manually_selected: (value as { is_manually_selected: boolean })[
              "is_manually_selected"
            ],
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
    <main
      className="reports-main"
      ref={reportsRef}
      style={{ gridTemplateColumns: `${columnSplit}fr 8px ${1 - columnSplit}fr` }}
    >
      <div
        className="reports-col"
        ref={leftColumnRef}
        style={{ gridTemplateRows: `${leftPanelSplit}fr 8px ${1 - leftPanelSplit}fr` }}
      >
        <div className="reports-card reports-map-card">
          <TuasMap className={"reports-map"} lat={51} lng={10}>
            <FlightBounds FlightBounds SearchBounds></FlightBounds>
            <UpdateMapCenter position={maploc} />
            <MapOnClickHandler />
            {clusters.map((e) => MapCluster(e))}
            {renderCurrentMarker()}
          </TuasMap>
        </div>
        <div
          className="reports-resizer reports-row-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize map and detections panels"
          tabIndex={0}
          onPointerDown={beginResize}
          onPointerMove={(event) =>
            resizeSplit(event, leftColumnRef.current, setLeftPanelSplit, "y")
          }

        />
        <div className="reports-card reports-cluster-data">
          <div className="reports-cluster-bottom-section">
            Selected Cluster:
            {
              <div className="reports-cluster-container">
                <div>
                  <select className="reports-button"
                    ref={selection}
                    onChange={(e) => {
                      setSelectedCluster(+e.target.value);
                    }}
                  >
                    <option value={-1} >All clusters</option>
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
                  <br></br>
                  Airdrop {getSelectedCluster()?.airdrop_type}
                  <br></br>
                  Current Chosen Center:{" "}
                  {(() => {
                    const cluster = getSelectedCluster();
                    return cluster
                      ? GPSCoordToString(
                        cluster.is_manually_selected
                          ? cluster.selected_center
                          : cluster.calculated_center,
                      )
                      : "N/A";
                  })()}
                  <br></br>
                  Calculated Center:{" "}
                  {(() => {
                    const cluster = getSelectedCluster();
                    return cluster ? GPSCoordToString(cluster.calculated_center) : "N/A";
                  })()}
                  <br></br>Using Manual Center?: {getSelectedCluster()?.is_manually_selected}
                  {getSelectedCluster()?.is_manually_selected && (
                    <button
                      onClick={() => {
                        fetch(CLEAR_MANUAL_ENDPOINT, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            id: selectedCluster,
                          }),
                        }).then(() => {
                          syncWithoutFetchingOBC();
                        });
                      }}
                    >
                      Clear Manual Selection
                    </button>
                  )}
                </div>
                <div className="reports-table-wrapper">
                  <table className="reports-cluster-table">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th aria-sort={sort.field === "type" ? sort.direction : "none"}>
                          <button
                            className="reports-sort-button"
                            type="button"
                            onClick={() => toggleSort("type")}
                          >
                            Airdrop Type
                            {sort.field === "type" &&
                              (sort.direction === "ascending" ? " ↑" : " ↓")}
                          </button>
                        </th>
                        <th aria-sort={sort.field === "rejected" ? sort.direction : "none"}>
                          <button
                            className="reports-sort-button"
                            type="button"
                            onClick={() => toggleSort("rejected")}
                          >
                            Included?
                            {sort.field === "rejected" &&
                              (sort.direction === "ascending" ? " ↑" : " ↓")}
                          </button>
                        </th>
                        <th aria-sort={sort.field === "id" ? sort.direction : "none"}>
                          <button
                            className="reports-sort-button"
                            type="button"
                            onClick={() => toggleSort("id")}
                          >
                            Global Id
                            {sort.field === "id" &&
                              (sort.direction === "ascending" ? " ↑" : " ↓")}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="reports-cluster-table-body">
                      {getSortedDetections().map((p, i) => {
                        const clusterColor =
                          clusters.find((cluster) => cluster.airdrop_type === p.type)?.color ??
                          GetNextColor(p.type);
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
                            <td>{GPSCoordToString(p.location)}</td>

                            <td
                              style={{
                                color: `rgb(${clusterColor[0]}, ${clusterColor[1]}, ${clusterColor[2]})`,
                              }}
                            >
                              {getAirdropString(p.type)}
                            </td>
                            <td>
                              {p.rejected ? (
                                <span style={{ color: "red" }}>False</span>
                              ) : (
                                <span style={{ color: "green" }}>True</span>
                              )}
                            </td>
                            <td>{p.id}</td>
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
      <div
        className="reports-resizer reports-column-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize report columns"
        tabIndex={0}
        onPointerDown={beginResize}
        onPointerMove={(event) =>
          resizeSplit(event, reportsRef.current, setColumnSplit, "x")
        }

      />
      <div
        className="reports-col"
        ref={rightColumnRef}
        style={{ gridTemplateRows: `${rightPanelSplit}fr 8px ${1 - rightPanelSplit}fr` }}
      >
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
        <div
          className="reports-resizer reports-row-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize detection and controls panels"
          tabIndex={0}
          onPointerDown={beginResize}
          onPointerMove={(event) =>
            resizeSplit(event, rightColumnRef.current, setRightPanelSplit, "y")
          }

        />
        <div className="reports-card reports-control-card">
          Controls<br></br>

          <label>
            <input
              type="checkbox"
              checked={backgroundFetchingInterval !== -1}
              onChange={(e) => {
                setBackgroundFetching(e.target.checked ? 5 : -1);
              }}
            />{" "}
            Auto-refresh every 5 seconds
          </label>
          <div>{fetchingMessage}</div>
          <br />
          <div className="reports-button-container">
            <button onClick={() => setManualVisor()} className="reports-button">Move marker</button>
            <button className="reports-button" onClick={launchAirDrops}>Confirm Launch</button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Reports;
