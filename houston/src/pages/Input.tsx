import { SetStateAction, useState, useEffect, ChangeEvent } from "react";
import { useMapEvents, Polygon, Polyline } from "react-leaflet";
import "./Input.css";
import TuasMap from "../components/TuasMap";
import { LatLng } from "leaflet";
import {
    Airdrop,
    AirdropIndex,
    GPSCoord,
    Mission,
    ODLCObjects,
} from "../protos/obc.pb";
import MyModal from "../components/MyModal";
import UpdateMapCenter from "../components/UpdateMapCenter";
import { useMyModal } from "../components/UseMyModal";

enum MapMode {
    FlightBound,
    SearchBound,
    MappingBound,
    Waypoint,
    InitialPath,
    SearchPath,
}

enum ShapeType {
    Line,
    Polygon,
    Discrete,
}

interface MapModeConfig {
    color: string;
    headings: string[];
    type: ShapeType;
    editable: boolean;
}

const getModeConfig = (mapMode: MapMode) => {
    switch (mapMode) {
        case MapMode.FlightBound:
            return {
                color: "red",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Polygon,
                editable: true,
            } as MapModeConfig;
        case MapMode.SearchBound:
            return {
                color: "blue",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Polygon,
                editable: true,
            } as MapModeConfig;
        case MapMode.MappingBound:
            return {
                color: "orange",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Polygon,
                editable: true,
            } as MapModeConfig;
        case MapMode.Waypoint:
            return {
                color: "yellow",
                headings: ["Latitude", "Longitude", "Altitude"],
                type: ShapeType.Line,
                editable: true,
            } as MapModeConfig;
        case MapMode.InitialPath:
            return {
                color: "lightgreen",
                headings: ["Latitude", "Longitude", "Altitude"],
                type: ShapeType.Line,
                editable: false,
            } as MapModeConfig;
        case MapMode.SearchPath:
            return {
                color: "violet",
                headings: ["Latitude", "Longitude", "Altitude"],
                type: ShapeType.Discrete,
                editable: false,
            } as MapModeConfig;
    }
};

/**
 * Component which takes in all the state for the current map mode and data,
 * and renders the table containing all of the values for the current mode.
 * @param props Props
 * @param props.headings Array for the heading values of the current map mode
 * e.g. ["Latitude", "Longitude", "Altitude"] for Waypoint mode
 * @param props.mapMode Current mode of the map
 * @param props.mapData Current lat/lng/alt data points of the map, per map mode
 * @param props.setMapData setter for props.mapData
 * @returns FormTable
 */
function FormTable({
    headings,
    mapMode,
    mapData,
    setMapData,
}: {
    headings: string[];
    mapMode: MapMode;
    mapData: Map<MapMode, number[][]>;
    setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>;
}) {
    // add extra left column for the X button
    const displayHeadings = ["---"].concat(headings);

    return (
        <>
            <table>
                <thead>
                    <tr>
                        {displayHeadings.map((str, i) => (
                            <th key={i}>{str}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {mapData.get(mapMode)?.map((row, i) => {
                        return (
                            <tr key={i}>
                                <td>
                                    <input
                                        type="button"
                                        className="del-btn"
                                        value="X"
                                        onClick={() => {
                                            const data = mapData.get(mapMode);
                                            if (
                                                !getModeConfig(mapMode).editable
                                            ) {
                                                return;
                                            }

                                            setMapData((currentMapData) => {
                                                // Changed mapData to currentMapData to avoid shadow
                                                if (data !== undefined) {
                                                    const temp = data
                                                        .slice(0, i)
                                                        .concat(
                                                            data.slice(i + 1)
                                                        );
                                                    return new Map(
                                                        currentMapData.set(
                                                            // use currentMapData
                                                            mapMode,
                                                            temp
                                                        )
                                                    );
                                                } else {
                                                    return currentMapData; // should never happen
                                                }
                                            });
                                        }}
                                    />
                                </td>
                                {row.map((num, j) => {
                                    return (
                                        <td key={j}>
                                            <input
                                                type="number"
                                                key={
                                                    mapMode.toString() +
                                                    mapData
                                                        .get(mapMode)
                                                        ?.at(i)
                                                        ?.at(j) +
                                                    `${i}-${j}` // Ensure key is more unique
                                                }
                                                step="any"
                                                defaultValue={num}
                                                readOnly={
                                                    !getModeConfig(mapMode)
                                                        .editable
                                                } // Added readOnly based on editable config
                                                onChange={(e) => {
                                                    if (
                                                        !getModeConfig(mapMode)
                                                            .editable
                                                    )
                                                        return; // Prevent change if not editable

                                                    const newArr =
                                                        mapData.get(mapMode);
                                                    if (newArr == undefined) {
                                                        return;
                                                    }
                                                    newArr[i][j] = Number(
                                                        e.target.value
                                                    );
                                                    setMapData(
                                                        new Map( // Create a new Map to ensure re-render
                                                            new Map(
                                                                mapData
                                                            ).set(
                                                                // Create a new inner map as well
                                                                mapMode,
                                                                newArr.map(
                                                                    (r) => [
                                                                        ...r,
                                                                    ]
                                                                ) // Ensure rows are new arrays
                                                            )
                                                        )
                                                    );
                                                }}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </>
    );
}

/**
 * Form that contains all of the controls for entering flight boundary, search boundary,
 * and waypoint data for the mission
 * @returns Map Input Form
 */

/**
 * Component which renders all of the form input relating to the map.
 * Delagates the actual displaying of table data to <FormTable />
 * Handles the buttons that switch the current map mode.
 * @param props Props
 * @param props.mapMode Current mode of the map
 * @param props.setMapMode setter for the current mode of the map
 * @param props.mapData Current data for the map (latlng points)
 * @param props.setMapData setter for the map data
 * @param props.onOpenWaypointJsonModal Callback to open the JSON import modal for waypoints
 * @returns MapInputForm
 */
function MapInputForm({
    mapMode,
    setMapMode,
    mapData,
    setMapData,
    onOpenWaypointJsonModal,
}: {
    mapMode: MapMode;
    setMapMode: React.Dispatch<SetStateAction<MapMode>>;
    mapData: Map<MapMode, number[][]>;
    setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>;
    onOpenWaypointJsonModal: () => void;
}) {
    return (
        <>
            <form className="tuas-form">
                <fieldset>
                    <legend>Map Input</legend>
                    <div className="button-container">
                        {Object.keys(MapMode)
                            .filter((v) => isNaN(Number(v)))
                            .map((v, i) => {
                                const modeKey = v as keyof typeof MapMode;
                                return (
                                    <input
                                        key={i}
                                        data-selected={
                                            mapMode === MapMode[modeKey]
                                        }
                                        type="button"
                                        value={v
                                            .replace(/([A-Z])/g, " $1")
                                            .trim()}
                                        onClick={() => {
                                            setMapMode(MapMode[modeKey]);
                                        }}
                                    />
                                );
                            })}
                        <input
                            type="button"
                            value="+"
                            className="add-btn"
                            disabled={!getModeConfig(mapMode).editable}
                            onClick={() => {
                                if (!getModeConfig(mapMode).editable) {
                                    return;
                                }
                                const headingLength =
                                    getModeConfig(mapMode).headings.length;
                                const newRow = new Array(headingLength).fill(0);

                                setMapData((currentMapData) => {
                                    const currentModeData =
                                        currentMapData.get(mapMode) || [];
                                    return new Map(
                                        currentMapData.set(mapMode, [
                                            ...currentModeData,
                                            newRow,
                                        ])
                                    );
                                });
                            }}
                        />
                        <input
                            type="button"
                            value="-"
                            className="del-btn"
                            disabled={
                                !getModeConfig(mapMode).editable ||
                                (mapData.get(mapMode)?.length || 0) === 0
                            }
                            onClick={() => {
                                if (!getModeConfig(mapMode).editable) {
                                    return;
                                }
                                setMapData((currentMapData) => {
                                    const data = currentMapData.get(mapMode);
                                    if (data !== undefined && data.length > 0) {
                                        return new Map(
                                            currentMapData.set(
                                                mapMode,
                                                data.slice(0, -1)
                                            )
                                        );
                                    }
                                    return currentMapData;
                                });
                            }}
                        />
                        {mapMode === MapMode.Waypoint &&
                            getModeConfig(mapMode).editable && (
                                <input
                                    type="button"
                                    value="Import JSON"
                                    className="import-json-btn"
                                    onClick={onOpenWaypointJsonModal}
                                />
                            )}
                    </div>
                    <FormTable
                        headings={getModeConfig(mapMode).headings}
                        mapMode={mapMode}
                        mapData={mapData}
                        setMapData={setMapData}
                    />
                </fieldset>
            </form>
        </>
    );
}

/**
 * Form that handles all the input for entering airdrop loading information
 * on the plane for the mission
 * @param props props
 * @param props.airdropAssignments The list of current entered airdrop assignments
 * @param props.setAirdropAssignments State setter for props.airdropAssignments
 * @returns airdrop Input Form
 */
function AirdropInputForm({
    airdropAssignments,
    setAirdropAssignments,
}: {
    airdropAssignments: Airdrop[];
    setAirdropAssignments: React.Dispatch<SetStateAction<Airdrop[]>>;
}) {
    /**
     * Maps the keys of the `ODLCObjects` object to an array of JSX `<option>` elements.
     * Filters out numeric keys before mapping.
     * @returns An array of JSX `<option>` elements.
     */
    function mapObjectsToOptions() {
        return (
            Object.keys(ODLCObjects) as unknown as Array<
                keyof typeof ODLCObjects
            >
        ) // Corrected type
            .filter((objectKey) => {
                return isNaN(Number(ODLCObjects[objectKey])); // Filter by value if keys are strings
            })
            .map((objectKey) => {
                return (
                    <option key={objectKey} value={ODLCObjects[objectKey]}>
                        {" "}
                        {/* Use enum value for submission */}
                        {objectKey} {/* Display enum key name */}
                    </option>
                );
            });
    }

    const airdropInput = (airdrop: Airdrop, index: number) => {
        // Added index for unique key
        return (
            <fieldset key={airdrop.Index || index}>
                {" "}
                {/* Use index if Index is not yet set */}
                <legend>
                    Airdrop{" "}
                    {AirdropIndex[airdrop.Index] || `Pending ${index + 1}`}
                </legend>
                <label>
                    Object:
                    <select
                        value={airdrop.Object} // Controlled component
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            setAirdropAssignments((prevAssignments) =>
                                prevAssignments.map((ad) =>
                                    ad.Index === airdrop.Index
                                        ? {
                                              ...ad,
                                              Object: Number(
                                                  e.target.value
                                              ) as ODLCObjects,
                                          }
                                        : ad
                                )
                            );
                        }}
                    >
                        {mapObjectsToOptions()}
                    </select>
                </label>
            </fieldset>
        );
    };

    useEffect(() => {
        if (airdropAssignments.length === 0) {
            // Initialize only if empty
            const airdrops = [];
            for (let i = AirdropIndex.Kaz; i <= AirdropIndex.Daniel; i++) {
                const airdrop = {
                    Index: i,
                    Object: ODLCObjects[
                        Object.keys(ODLCObjects)[i] as keyof typeof ODLCObjects
                    ], // Default object
                } as Airdrop;
                airdrops.push(airdrop);
            }
            setAirdropAssignments(airdrops);
        }
    }, [setAirdropAssignments, airdropAssignments.length]);

    return (
        <>
            <form className="tuas-form">
                <fieldset>
                    <legend>Airdrop Input</legend>
                    <div className="airdrop-form-container">
                        {airdropAssignments.map(
                            (
                                airdrop,
                                index // Pass index
                            ) => airdropInput(airdrop, index) // Pass index
                        )}
                    </div>
                </fieldset>
            </form>
        </>
    );
}

/**
 * Component which gets placed inside of the leaflet map and listens for click events
 * on the map and then adjusts the relevant mapData state variable.
 * @param props Props
 * @param props.mapMode current mode of the map
 * @param props.mapData current data of the map
 * @param props.setMapData setter for the map data, used when the user
 * clicks on the map.
 * @returns MapClickHandler
 */
function MapClickHandler({
    mapMode,
    mapData,
    setMapData,
}: {
    mapMode: MapMode;
    mapData: Map<MapMode, number[][]>;
    setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>;
}) {
    useMapEvents({
        click(e) {
            const config = getModeConfig(mapMode);
            if (!config.editable) {
                return;
            }

            // Update the data state variable
            let data = mapData.get(mapMode);
            if (data == undefined) {
                data = [];
            }

            const newDataPoint = (() => {
                if (config.headings.length == 2) {
                    return [e.latlng.lat, e.latlng.lng];
                } else {
                    return [e.latlng.lat, e.latlng.lng, 75]; // fill in 75 for default alt
                }
            })();

            setMapData((prevMapData) => {
                const currentModeData = prevMapData.get(mapMode) || [];
                return new Map(prevMapData).set(mapMode, [
                    ...currentModeData,
                    newDataPoint,
                ]);
            });
        },
    });

    return null; // React components should return null or JSX, not <>{null}</>
}

/**
 * Component that is placed inside of the leaflet map and renders the relevant
 * polygons and lines from the state variable.
 * @param props Props
 * @param props.mapData current map data so that it can draw the right shapes
 * @returns MapIllustrator
 */
function MapIllustrator({ mapData }: { mapData: Map<MapMode, number[][]> }) {
    return (
        <>
            {Array.from(mapData).map(([mode, currData]) => {
                if (!currData || currData.length === 0) return null; // Don't render if no data

                const currConfig = getModeConfig(mode);
                const parsedData = currData.map(
                    (latlng) => new LatLng(latlng[0], latlng[1])
                );

                switch (currConfig.type) {
                    case ShapeType.Line:
                        return (
                            <Polyline
                                key={`${mode}-line-${JSON.stringify(
                                    parsedData
                                )}`} // More specific key
                                color={currConfig.color}
                                positions={parsedData}
                            />
                        );
                    case ShapeType.Polygon:
                        // Polygon needs at least 3 points to form a shape.
                        // For display purposes, it might draw with fewer, but Leaflet might complain or not draw.
                        if (parsedData.length < 1) return null; // Avoid empty polygon issues
                        return (
                            <Polygon
                                key={`${mode}-polygon-${JSON.stringify(
                                    parsedData
                                )}`} // More specific key
                                color={currConfig.color}
                                positions={[parsedData]} // Polygon expects array of arrays of LatLngs, or array of LatLngs
                            />
                        );
                    case ShapeType.Discrete:
                        // This will render many Polyline components if there are many points.
                        // Consider using Markers for better performance/semantics if appropriate.
                        return (
                            <>
                                {parsedData.map((latlng, index) => (
                                    <Polyline // This creates a tiny line segment (dot)
                                        key={`${mode}-discrete-${index}-${latlng.lat}-${latlng.lng}`} // More specific key
                                        positions={[
                                            latlng,
                                            new LatLng(
                                                latlng.lat + 0.000001,
                                                latlng.lng + 0.000001
                                            ),
                                        ]} // Make it a tiny line to be visible
                                        color={currConfig.color}
                                        weight={5} // Make dots more visible
                                    />
                                ))}
                            </>
                        );
                    default:
                        return null;
                }
            })}
        </>
    );
}

/**
 * Component for the entire input page, which lets the user input all of the
 * relevant mission information needed to start the mission.
 * This data includes:
 *    1. The Flight Boundaries
 *    2. The Search Boundaries
 *    3. The Competition Waypoints
 * This is all of the input needed to start the mission.
 * @returns Input page
 */
function Input() {
    const [mapMode, setMapMode] = useState<MapMode>(MapMode.FlightBound);
    const [mapData, setMapData] = useState<Map<MapMode, number[][]>>(new Map());
    const [airdropAssignments, setAirdropAssignments] = useState<Airdrop[]>([]);

    const [modalType, setModalType] = useState<"default" | "error">("default");
    const [modalMsg, setModalMsg] = useState("");
    const [msgModalVisible, setMsgModalVisible] = useState(false);
    const [defaultView, setDefaultView] = useState<[number, number]>([
        38.314666970000744, -76.54975138401012,
    ]);
    const { modalVisible, openModal, closeModal } = useMyModal();

    const [isWaypointJsonModalOpen, setIsWaypointJsonModalOpen] =
        useState(false);
    const [waypointJsonInput, setWaypointJsonInput] = useState("");

    /**
     * Displays an error message in a modal dialog
     * @param msg - The error message to display
     */
    function displayError(msg: string) {
        setModalType("error");
        setModalMsg(msg);
        setMsgModalVisible(true);
    }

    /**
     * Displays a regular message in a modal dialog
     * @param msg - The message to display
     */
    function displayMsg(msg: string) {
        setModalType("default");
        setModalMsg(msg);
        setMsgModalVisible(true);
    }

    // NEW: Handler for file input
    const handleFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        // Basic validation for file type (though 'accept' attribute should mostly handle this)
        if (file.type !== "application/json" && !file.name.endsWith(".json")) {
            displayError("Invalid file type. Please select a .json file.");
            event.target.value = ""; // Clear the file input
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === "string") {
                    setWaypointJsonInput(text); // Populate the textarea with file content
                    displayMsg(
                        `Content from "${file.name}" loaded into the text area. Review and click Submit.`
                    );
                } else {
                    throw new Error("Could not read file content as text.");
                }
            } catch (err) {
                console.error("Error processing file content:", err);
                const errorMessage =
                    err instanceof Error ? err.message : "Unknown error";
                displayError(`Error reading file content: ${errorMessage}`);
            }
        };
        reader.onerror = () => {
            console.error("FileReader error:", reader.error);
            displayError(
                `Failed to read file: ${
                    reader.error?.message || "Unknown FileReader error"
                }`
            );
        };
        reader.readAsText(file);

        // Clear the file input so the same file can be selected again if needed
        event.target.value = "";
    };

    const handleImportWaypointsFromJson = () => {
        try {
            if (!waypointJsonInput.trim()) {
                throw new Error("JSON input cannot be empty.");
            }
            const parsedInput = JSON.parse(waypointJsonInput);

            if (!Array.isArray(parsedInput)) {
                throw new Error("Input must be a JSON array of waypoints.");
            }

            const newWaypoints: number[][] = [];
            for (const item of parsedInput) {
                if (
                    !Array.isArray(item) ||
                    item.length !== 3 || // Expecting [lat, lng, alt]
                    !item.every((coord) => typeof coord === "number")
                ) {
                    throw new Error(
                        "Each waypoint must be an array of 3 numbers: [latitude, longitude, altitude]." +
                            ` Invalid item: ${JSON.stringify(item)}`
                    );
                }
                newWaypoints.push(item as [number, number, number]);
            }

            if (newWaypoints.length === 0 && parsedInput.length > 0) {
                throw new Error("No valid waypoints found in the JSON data.");
            }
            if (newWaypoints.length === 0 && parsedInput.length === 0) {
                // If user submits an empty array []
                displayMsg("No waypoints to import (empty array).");
                setIsWaypointJsonModalOpen(false);
                setWaypointJsonInput("");
                return;
            }

            setMapData((prevMapData) => {
                const existingWaypoints =
                    prevMapData.get(MapMode.Waypoint) || [];
                const updatedWaypoints = [
                    ...existingWaypoints,
                    ...newWaypoints,
                ];
                return new Map(prevMapData).set(
                    MapMode.Waypoint,
                    updatedWaypoints
                );
            });

            displayMsg(
                `${newWaypoints.length} waypoint(s) imported successfully.`
            );
            setWaypointJsonInput("");
            setIsWaypointJsonModalOpen(false);
        } catch (error) {
            let errorMessage = "Failed to import waypoints from JSON. ";
            if (error instanceof Error) {
                errorMessage += error.message;
            } else {
                errorMessage += "Unknown error.";
            }
            console.error("JSON Import Error:", error);
            displayError(errorMessage);
        }
    };

    /**
     * Submits the current mission configuration to the server
     * Converts map data to GPS coordinates and sends the mission object
     * including airdrop assignments, boundaries, and waypoints
     */
    function submitMission() {
        const mapDataToGpsCoords = (mode: MapMode) => {
            const config = getModeConfig(mode);
            const data = mapData.get(mode) || []; // Ensure data is an array

            return data.map((row) => {
                const latIndex = config.headings.indexOf("Latitude");
                const lonIndex = config.headings.indexOf("Longitude");
                const altIndex = config.headings.indexOf("Altitude");

                return {
                    Latitude: row[latIndex > -1 ? latIndex : 0], // Default to 0 if not found
                    Longitude: row[lonIndex > -1 ? lonIndex : 1], // Default to 1 if not found
                    Altitude:
                        altIndex > -1 && row[altIndex] !== undefined
                            ? row[altIndex]
                            : 0, // Default alt to 0 if not present
                } as GPSCoord;
            });
        };

        const mission: Mission = {
            AirdropAssignments: airdropAssignments,
            FlightBoundary: mapDataToGpsCoords(MapMode.FlightBound),
            AirdropBoundary: mapDataToGpsCoords(MapMode.SearchBound), // This used to be SearchBound, changed to AirdropBoundary as per proto?
            MappingBoundary: mapDataToGpsCoords(MapMode.MappingBound),
            Waypoints: mapDataToGpsCoords(MapMode.Waypoint),
        };

        console.log("Submitting Mission:", mission); // For debugging

        fetch("/api/mission", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(mission),
        })
            .then(async (response) => {
                // made async to await text()
                if (response.ok) {
                    // Check for 2xx status codes
                    return response.text();
                } else {
                    const errorText = await response.text(); // Await error text
                    throw new Error(
                        errorText ||
                            `Request failed with status ${response.status}`
                    );
                }
            })
            .then((succ_msg) => {
                displayMsg(succ_msg || "Mission submitted successfully!");
            })
            .catch((err) => {
                // Catch both Error objects and strings
                console.error("Submit Mission Error:", err);
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                displayError(
                    `An error occured while uploading the mission: ${errorMessage}. See console for more info.`
                );
            });
    }

    /**
     * Requests both initial and coverage paths from the server
     * Updates the map data with the received paths
     */
    function requestPath() {
        fetch("/api/path/initial")
            .then(async (resp) => {
                if (resp.ok) return resp.json();
                const errorText = await resp.text();
                throw new Error(
                    errorText || `Request failed with status ${resp.status}`
                );
            })
            .then((path) => {
                const pathJson = path as GPSCoord[];
                const data = pathJson.map((obj) => [
                    obj.Latitude,
                    obj.Longitude,
                    obj.Altitude,
                ]);
                setMapData(
                    (currentMapData) =>
                        new Map(currentMapData.set(MapMode.InitialPath, data))
                );
            })
            .catch((err) => {
                console.error("Request Initial Path Error:", err);
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                displayError(`Error requesting initial path: ${errorMessage}.`);
            });

        fetch("/api/path/coverage")
            .then(async (resp) => {
                if (resp.ok) return resp.json();
                const errorText = await resp.text();
                throw new Error(
                    errorText || `Request failed with status ${resp.status}`
                );
            })
            .then((path) => {
                const pathJson = path as GPSCoord[];
                const data = pathJson.map((obj) => [
                    obj.Latitude,
                    obj.Longitude,
                    obj.Altitude,
                ]);
                setMapData(
                    (currentMapData) =>
                        new Map(currentMapData.set(MapMode.SearchPath, data))
                );
            })
            .catch((err) => {
                console.error("Request Coverage Path Error:", err);
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                displayError(
                    `Error requesting coverage path: ${errorMessage}.`
                );
            });
    }

    /**
     * Validates the current initial path configuration
     * Sends a validation request to the server
     */
    function validatePath() {
        fetch("/api/path/initial/validate", { method: "POST" })
            .then(async (resp) => {
                if (resp.ok) return resp.text();
                const errorText = await resp.text();
                throw new Error(
                    errorText || `Request failed with status ${resp.status}`
                );
            })
            .then((respMsg) =>
                displayMsg(respMsg || "Path validation successful.")
            )
            .catch((err) => {
                console.error("Validate Path Error:", err);
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                displayError(`Error validating path: ${errorMessage}.`);
            });
    }

    /**
     * Generates a new optimal path configuration
     * Sends a request to the server to generate a new path
     */
    function generateNewPath() {
        fetch("/api/path/initial/new")
            .then(async (resp) => {
                if (resp.ok) return resp.text();
                const errorText = await resp.text();
                throw new Error(
                    errorText || `Request failed with status ${resp.status}`
                );
            })
            .then((respMsg) =>
                displayMsg(respMsg || "New path generated successfully.")
            )
            .catch((err) => {
                console.error("Generate New Path Error:", err);
                const errorMessage =
                    err instanceof Error ? err.message : String(err);
                displayError(`Error generating new path: ${errorMessage}.`);
            });
    }

    /**
     * Changes the default view and map data based on the selected location
     * @param selected - The name of the selected location (Black_Mountain, Competition_Left, or Competition_Right)
     */
    function changingDeafultView(selected: string) {
        let newView: [number, number] = defaultView;
        const newMapData = new Map(mapData); // Create a mutable copy

        if (selected === "Black_Mountain") {
            newView = [32.990781135309724, -117.12830536731832];
            newMapData.set(MapMode.FlightBound, []);
            newMapData.set(MapMode.SearchBound, []);
            newMapData.set(MapMode.MappingBound, []);
        } else if (selected === "Competition_Left") {
            newView = [38.314666970000744, -76.54975138401012];
            newMapData.set(MapMode.FlightBound, [
                [38.31729702009844, -76.55617670782419],
                [38.31594832826572, -76.55657341657302],
                [38.31546739500083, -76.55376201277696],
                [38.31470980862425, -76.54936361414539],
                [38.31424154692598, -76.54662761646904],
                [38.31369801280048, -76.54342380058223],
                [38.31331079191371, -76.54109648475954],
                [38.31529941346197, -76.54052104837133],
                [38.31587643291039, -76.54361305817427],
                [38.31861642463319, -76.54538594175376],
                [38.31862683616554, -76.55206138505936],
                [38.31703471119464, -76.55244787859773],
                [38.31674255749409, -76.55294546866578],
                [38.31729702009844, -76.55617670782419],
            ]);
            newMapData.set(MapMode.SearchBound, [
                [38.315683, -76.552586],
                [38.315386, -76.550875],
                [38.315607, -76.5508],
                [38.315895, -76.552519],
            ]);
            newMapData.set(MapMode.MappingBound, [
                [38.314816, -76.548947],
                [38.31546, -76.552653],
                [38.316639, -76.55233],
                [38.316016, -76.5486],
            ]);
        } else if (selected === "Competition_Right") {
            newView = [38.314666970000744, -76.54975138401012];
            newMapData.set(MapMode.FlightBound, [
                /* Same as Competition_Left for brevity */
                [38.31729702009844, -76.55617670782419],
                [38.31594832826572, -76.55657341657302],
                [38.31546739500083, -76.55376201277696],
                [38.31470980862425, -76.54936361414539],
                [38.31424154692598, -76.54662761646904],
                [38.31369801280048, -76.54342380058223],
                [38.31331079191371, -76.54109648475954],
                [38.31529941346197, -76.54052104837133],
                [38.31587643291039, -76.54361305817427],
                [38.31861642463319, -76.54538594175376],
                [38.31862683616554, -76.55206138505936],
                [38.31703471119464, -76.55244787859773],
                [38.31674255749409, -76.55294546866578],
                [38.31729702009844, -76.55617670782419],
            ]);
            newMapData.set(MapMode.SearchBound, [
                [38.314529, -76.545859],
                [38.314228, -76.544156],
                [38.314441, -76.544081],
                [38.314731, -76.545792],
            ]);
            newMapData.set(MapMode.MappingBound, [
                [38.314669, -76.547987],
                [38.315873, -76.547611],
                [38.315208, -76.54384],
                [38.314008, -76.544237],
            ]);
        } else {
            // Default to clearing if unknown selection
            newView = [51, 10]; // Or your preferred truly default view
            newMapData.set(MapMode.FlightBound, []);
            newMapData.set(MapMode.SearchBound, []);
            newMapData.set(MapMode.MappingBound, []);
        }
        setDefaultView(newView);
        setMapData(newMapData); // Set the modified map data
    }

    useEffect(() => {
        // Automatically select a default view on initial load, e.g., Competition Left
        changingDeafultView("Competition_Left");
        openModal(); // Open the initial information modal
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    return (
        <>
            <MyModal modalVisible={modalVisible} closeModal={closeModal}>
                {/* ... content of the initial info modal ... */}
                <h1>IMPORTANT NOTE</h1>
                <p>
                    Make sure to input the search zone only with 4 coordinates
                    and in the following order:
                </p>
                <p>
                    Bottom Left {">"} Bottom Right {">"} Top Right {">"} Top
                    Left
                </p>
                <fieldset>
                    <legend>Default Location</legend>
                    <label style={{ display: "block", margin: "5px 0" }}>
                        <input
                            type="radio"
                            name="default_location"
                            value="Black_Mountain"
                            // checked={defaultView[0] === 32.990781135309724}
                            onChange={() =>
                                changingDeafultView("Black_Mountain")
                            }
                        />
                        Black Mountain
                    </label>
                    <label style={{ display: "block", margin: "5px 0" }}>
                        <input
                            type="radio"
                            name="default_location"
                            value="Competition_Left"
                            // checked={defaultView[0] === 38.314666970000744 && mapData.get(MapMode.SearchBound)?.[0]?.[0] === 38.315683}
                            onChange={() =>
                                changingDeafultView("Competition_Left")
                            }
                            defaultChecked // Or manage checked state more robustly
                        />
                        Competition Left
                    </label>
                    <label style={{ display: "block", margin: "5px 0" }}>
                        <input
                            type="radio"
                            name="default_location"
                            value="Competition_Right"
                            // checked={defaultView[0] === 38.314666970000744 && mapData.get(MapMode.SearchBound)?.[0]?.[0] === 38.314529}
                            onChange={() =>
                                changingDeafultView("Competition_Right")
                            }
                        />
                        Competition Right
                    </label>
                </fieldset>
            </MyModal>

            {/* Waypoint JSON Import Modal - MODIFIED */}
            <MyModal
                modalVisible={isWaypointJsonModalOpen}
                closeModal={() => {
                    setIsWaypointJsonModalOpen(false);
                    // setWaypointJsonInput(""); // Optionally clear on any close
                }}
            >
                <div
                    style={{
                        padding: "10px 20px",
                        maxWidth: "500px",
                        margin: "auto",
                    }}
                >
                    <h2>Import Waypoints via JSON</h2>
                    <p>
                        Paste JSON directly into the text area below,{" "}
                        <strong>OR</strong> load waypoints from a local{" "}
                        <code>.json</code> file.
                    </p>
                    <p>
                        Expected format: An array of waypoint arrays, e.g.,{" "}
                        <code>[[lat1, lng1, alt1], [lat2, lng2, alt2]]</code>
                    </p>

                    <div style={{ margin: "20px 0" }}>
                        <label
                            htmlFor="waypoint-file-input"
                            style={{
                                display: "inline-block",
                                padding: "8px 12px",
                                cursor: "pointer",
                                border: "1px solid #007bff",
                                borderRadius: "4px",
                                backgroundColor: "#e7f3ff",
                                color: "#007bff",
                                textAlign: "center",
                                marginBottom: "10px",
                            }}
                        >
                            Load Waypoints from .json File
                        </label>
                        <input
                            id="waypoint-file-input"
                            type="file"
                            accept=".json,application/json" // More specific accept types
                            onChange={handleFileChosen}
                            style={{ display: "none" }} // Hide default input, label acts as trigger
                        />
                        <p
                            style={{
                                fontSize: "0.9em",
                                color: "#555",
                                marginTop: "5px",
                            }}
                        >
                            If using a file, its content will appear in the text
                            area below for review before submission.
                        </p>
                    </div>

                    <p
                        style={{
                            textAlign: "center",
                            margin: "15px 0",
                            fontWeight: "bold",
                        }}
                    >
                        JSON Input Area:
                    </p>
                    <textarea
                        value={waypointJsonInput}
                        onChange={(e) => setWaypointJsonInput(e.target.value)}
                        rows={10}
                        style={{
                            width: "calc(100% - 16px)", // Account for padding
                            minHeight: "150px",
                            fontFamily: "monospace",
                            padding: "8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            marginTop: "5px",
                            boxSizing: "border-box",
                        }}
                        placeholder="[[38.316, -76.547, 75], [38.315, -76.546, 150]]"
                    />
                    <div
                        style={{
                            marginTop: "20px",
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "10px",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setIsWaypointJsonModalOpen(false);
                                // setWaypointJsonInput(""); // Optionally clear on cancel
                            }}
                            style={{
                                padding: "10px 18px",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                cursor: "pointer",
                                backgroundColor: "#f0f0f0",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleImportWaypointsFromJson}
                            style={{
                                padding: "10px 18px",
                                border: "none",
                                borderRadius: "4px",
                                backgroundColor: "#28a745",
                                color: "white",
                                cursor: "pointer",
                            }}
                        >
                            Submit Waypoints
                        </button>
                    </div>
                </div>
            </MyModal>

            <main className="input-page">
                <TuasMap
                    className="input-map"
                    lat={defaultView[0]}
                    lng={defaultView[1]}
                    key={`${defaultView[0]}-${defaultView[1]}`}
                >
                    <MapClickHandler
                        mapMode={mapMode}
                        mapData={mapData}
                        setMapData={setMapData}
                    />
                    <MapIllustrator mapData={mapData} />
                    <UpdateMapCenter position={defaultView} />
                </TuasMap>
                <div className="right-container">
                    <MapInputForm
                        mapMode={mapMode}
                        setMapMode={setMapMode}
                        mapData={mapData}
                        setMapData={setMapData}
                        onOpenWaypointJsonModal={() => {
                            if (mapMode !== MapMode.Waypoint) {
                                setMapMode(MapMode.Waypoint);
                            }
                            setWaypointJsonInput(""); // Clear previous input when opening modal
                            setIsWaypointJsonModalOpen(true);
                        }}
                    />
                    <AirdropInputForm
                        airdropAssignments={airdropAssignments}
                        setAirdropAssignments={setAirdropAssignments}
                    />
                    <form className="tuas-form input-controls">
                        <input
                            type="button"
                            onClick={submitMission}
                            value="Submit Mission" // More descriptive
                        />
                        <input
                            type="button"
                            onClick={requestPath}
                            value="Get Generated Paths" // Plural as it gets two
                        />
                        <input
                            type="button"
                            onClick={validatePath}
                            value="Validate Current Path"
                        />
                        <input
                            type="button"
                            onClick={generateNewPath}
                            value="Generate New Optimal Path"
                        />
                    </form>
                </div>
                <MyModal
                    modalVisible={msgModalVisible}
                    closeModal={() => setMsgModalVisible(false)}
                    type={modalType}
                >
                    {modalMsg}
                </MyModal>
            </main>
        </>
    );
}

export default Input;
