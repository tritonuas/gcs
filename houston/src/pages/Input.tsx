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
    DropLocation,
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
        case MapMode.DropLocation:
            return {
                color: "purple",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Line,
                editable: true,
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
    headings = ["---"].concat(headings);

    return (
        <>
            <table>
                <thead>
                    <tr>
                        {headings.map((str, i) => (
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

                                            setMapData((mapData) => {
                                                if (data !== undefined) {
                                                    const temp = data
                                                        .slice(0, i)
                                                        .concat(
                                                            data.slice(i + 1)
                                                        );
                                                    return new Map(
                                                        mapData.set(
                                                            mapMode,
                                                            temp
                                                        )
                                                    );
                                                } else {
                                                    return mapData; // should never happen
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
                                                step="any"
                                                defaultValue={num}
                                                onChange={(e) => {
                                                    const newArr =
                                                        mapData.get(mapMode);
                                                    if (newArr == undefined) {
                                                        return;
                                                    }
                                                    newArr[i][j] = Number(
                                                        e.target.value
                                                    );
                                                    setMapData(
                                                        new Map(
                                                            mapData.set(
                                                                mapMode,
                                                                newArr
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
 * @returns MapInputForm
 */
function MapInputForm({
    mapMode,
    setMapMode,
    mapData,
    setMapData,
}: {
    mapMode: MapMode;
    setMapMode: React.Dispatch<SetStateAction<MapMode>>;
    mapData: Map<MapMode, number[][]>;
    setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>;
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
                                return (
                                    <input
                                        key={i}
                                        data-selected={
                                            mapMode ==
                                            MapMode[v as keyof typeof MapMode]
                                        }
                                        type="button"
                                        readOnly={
                                            !getModeConfig(mapMode).editable
                                        }
                                        value={v}
                                        onClick={() => {
                                            setMapMode(
                                                MapMode[
                                                    v as keyof typeof MapMode
                                                ]
                                            );
                                        }}
                                    />
                                );
                            })}
                        <input
                            type="button"
                            value="+"
                            className="add-btn"
                            onClick={() => {
                                if (!getModeConfig(mapMode).editable) {
                                    return;
                                }
                                const data = mapData.get(mapMode);
                                const headingLength =
                                    getModeConfig(mapMode).headings.length;
                                const newRow = new Array(headingLength).fill(0);

                                setMapData((mapData) => {
                                    if (data !== undefined) {
                                        return new Map(
                                            mapData.set(
                                                mapMode,
                                                data.concat([newRow])
                                            )
                                        );
                                    } else {
                                        return new Map(
                                            mapData.set(mapMode, [newRow])
                                        );
                                    }
                                });
                            }}
                        />
                        <input
                            type="button"
                            value="-"
                            className="del-btn"
                            onClick={() => {
                                const data = mapData.get(mapMode);
                                if (!getModeConfig(mapMode).editable) {
                                    return;
                                }

                                setMapData((mapData) => {
                                    if (data !== undefined && data.length > 0) {
                                        return new Map(
                                            mapData.set(
                                                mapMode,
                                                data.slice(0, -1)
                                            )
                                        );
                                    } else {
                                        // can't remove anything if data is undefined because there is already nothing
                                        return mapData;
                                    }
                                });
                            }}
                        />
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
        return (Object.keys(ODLCObjects) as unknown as Array<ODLCObjects>)
            .filter((object) => {
                return isNaN(Number(object)); // Filters out numeric keys
            })
            .map((object) => {
                return (
                    <>
                        <option key={object} value={object}>
                            {object}
                        </option>
                    </>
                );
            });
    }

    const airdropInput = (airdrop: Airdrop) => {
        return (
            <>
                <fieldset key={airdrop.Index}>
                    <legend>Airdrop {airdrop.Index.toString()}</legend>
                    <label>
                        Object:
                        <select
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                                airdrop.Object = e.currentTarget
                                    .value as unknown as ODLCObjects;
                            }}
                        >
                            {mapObjectsToOptions()}
                        </select>
                    </label>
                </fieldset>
            </>
        );
    };

    useEffect(() => {
        const airdrops = [];
        for (let i = AirdropIndex.Kaz; i <= AirdropIndex.Daniel; i++) {
            const airdrop = {
                Index: i,
            } as Airdrop;
            airdrops.push(airdrop);
        }
        setAirdropAssignments(airdrops);
    }, [setAirdropAssignments]);

    return (
        <>
            <form className="tuas-form">
                <fieldset>
                    <legend>Airdrop Input</legend>
                    <div className="airdrop-form-container">
                        {airdropAssignments.map((airdrop) =>
                            airdropInput(airdrop)
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

            const newData = (() => {
                if (config.headings.length == 2) {
                    return [...data, [e.latlng.lat, e.latlng.lng]];
                } else {
                    return [...data, [e.latlng.lat, e.latlng.lng, 75]]; // fill in 75 for default alt
                }
            })();

            setMapData(new Map(mapData.set(mapMode, newData)));
        },
    });

    return <>{null}</>;
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
                const currConfig = getModeConfig(mode);
                const parsedData = currData.map(
                    (latlng) => new LatLng(latlng[0], latlng[1])
                );

                switch (currConfig.type) {
                    case ShapeType.Line:
                        return (
                            <Polyline
                                key={JSON.stringify(parsedData)}
                                color={currConfig.color}
                                positions={parsedData}
                            />
                        );
                    case ShapeType.Polygon:
                        return (
                            <Polygon
                                key={JSON.stringify(parsedData)}
                                color={currConfig.color}
                                positions={[parsedData]}
                            />
                        );
                    case ShapeType.Discrete:
                        // Idk why the fuck I can't map this to <Marker> tags... so doing this stupid hack
                        // ok on second thought this probably looks better with how many markers there would be
                        return (
                            <>
                                {parsedData.map((latlng, index) => (
                                    <Polyline
                                        key={index}
                                        positions={[latlng, latlng]}
                                    ></Polyline>
                                ))}
                            </>
                        );
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
    // TODO: simplify all of these state variables into one mission state variable
    // so instead of number[][] its actually storing them as GPS Coords...
    const [mapMode, setMapMode] = useState<MapMode>(MapMode.FlightBound);
    const [mapData, setMapData] = useState<Map<MapMode, number[][]>>(new Map());
    const [airdropAssignments, setAirdropAssignments] = useState<Airdrop[]>([]);

    const [modalType, setModalType] = useState<"default" | "error">("default");
    const [modalMsg, setModalMsg] = useState("");
    const [msgModalVisible, setMsgModalVisible] = useState(false);
    const [defaultView, setDefaultView] = useState<[number, number]>([51, 10]);
    const { modalVisible, openModal, closeModal } = useMyModal();

    /**
     *
     * @param msg Message to display in the modal as an error
     */
    function displayError(msg: string) {
        setModalType("error");
        setModalMsg(msg);
        setMsgModalVisible(true);
    }

    /**
     *
     * @param msg Message to display in the modal as normal text
     */
    function displayMsg(msg: string) {
        setModalType("default");
        setModalMsg(msg);
        setMsgModalVisible(true);
    }

    /**
     * Takes the current state of all the inputs and posts to Hub
     */
    function submitMission() {
        const mapDataToGpsCoords = (mode: MapMode) => {
            const config = getModeConfig(mode);

            return (
                mapData.get(mode)?.map((row) => {
                    return {
                        Latitude: row[config.headings.indexOf("Latitude")],
                        Longitude: row[config.headings.indexOf("Longitude")],
                        Altitude: row[config.headings.indexOf("Altitude")],
                    } as GPSCoord;
                }) || []
            );
        };

        const mission: Mission = {
            AirdropAssignments: airdropAssignments,
            FlightBoundary: mapDataToGpsCoords(MapMode.FlightBound),
            AirdropBoundary: mapDataToGpsCoords(MapMode.SearchBound),
            MappingBoundary: mapDataToGpsCoords(MapMode.MappingBound),
            Waypoints: mapDataToGpsCoords(MapMode.Waypoint),
            DropLocation: mapDataToGpsCoords(MapMode.DropLocation),
        };

        fetch("/api/mission", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(mission),
        })
            .then((response) => {
                if (response.status == 200) {
                    return response.text();
                } else {
                    throw response.text();
                }
            })
            .then((succ_msg) => {
                displayMsg(succ_msg);
            })
            .catch((err_msg) => {
                console.error(err_msg);
                displayError(
                    "An error occured while uploading the mission. See the console for more info."
                );
            });
    }

    /**
     * Helper function to request the initial path from the OBC
     */
    function requestPath() {
        fetch("/api/path/initial")
            .then((resp) => {
                if (resp.status == 200) {
                    return resp.json();
                } else {
                    throw resp.text();
                }
            })
            .then((path) => {
                const pathJson = path as {
                    Latitude: number;
                    Longitude: number;
                    Altitude: number;
                }[];
                const data = pathJson.map((obj) => [
                    obj.Latitude,
                    obj.Longitude,
                    obj.Altitude,
                ]);

                setMapData((mapData) => {
                    return new Map(mapData.set(MapMode.InitialPath, data));
                });
            })
            .catch((err) => {
                console.error(err);
                displayError(
                    "An error occured while requesting the initial path. See the console for more info."
                );
            });
        fetch("/api/path/coverage")
            .then((resp) => {
                if (resp.status == 200) {
                    return resp.json();
                } else {
                    throw resp.text();
                }
            })
            .then((path) => {
                const pathJson = path as {
                    Latitude: number;
                    Longitude: number;
                    Altitude: number;
                }[];
                const data = pathJson.map((obj) => [
                    obj.Latitude,
                    obj.Longitude,
                    obj.Altitude,
                ]);

                setMapData((mapData) => {
                    return new Map(mapData.set(MapMode.SearchPath, data));
                });
            })
            .catch((err) => {
                console.error(err);
                displayError(
                    "An error occured while requesting the initial path. See the console for more info."
                );
            });
    }

    /**
     * Helper function to validate the initial path from the OBC
     */
    function validatePath() {
        fetch("/api/path/initial/validate", { method: "POST" })
            .then((resp) => {
                if (resp.status == 200) {
                    return resp.text();
                } else {
                    throw resp.text();
                }
            })
            .then((resp) => displayMsg(resp))
            .catch((err) => {
                console.error(err);
                displayError(
                    "An error occured while uploading the mission. See the console for more info."
                );
            });
    }

    /**
     * Helper function to generate a new path from the OBC
     */
    function generateNewPath() {
        fetch("/api/path/initial/new")
            .then((resp) => {
                if (resp.status == 200) {
                    return resp.text();
                } else {
                    throw resp.text();
                }
            })
            .then((resp) => displayMsg(resp))
            .catch((err) => {
                console.error(err);
                displayError(
                    "An error occured while uploading the mission. See the console for more info."
                );
            });
    }

    /**
     * Heper function that sets variable (defaultView) to either
     * black mountain coordinates or competition coordinates.
     * @param selected The location selected.
     */
    function changingDeafultView(selected: string) {
        if (selected == "Black_Mountain") {
            setDefaultView([32.990781135309724, -117.12830536731832]);
            setMapData(new Map(mapData.set(MapMode.FlightBound, [])));
            setMapData(new Map(mapData.set(MapMode.SearchBound, [])));
            setMapData(new Map(mapData.set(MapMode.MappingBound, [])));
            setMapData(new Map(mapData.set(MapMode.Waypoint, [])));
        } else if (selected == "Competition_Left") {
            setDefaultView([38.314666970000744, -76.54975138401012]);
            setMapData(
                new Map(
                    mapData.set(MapMode.FlightBound, [
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
                    ])
                )
            );
            setMapData(
                new Map(
                    mapData.set(MapMode.SearchBound, [
                        [38.315683, -76.552586], //bl
                        [38.315386, -76.550875], //br
                        [38.315607, -76.5508],   //tr
                        [38.315895, -76.552519], //tl
                    ])
                )
            );
            setMapData(
                new Map(
                    mapData.set(MapMode.MappingBound, [
                        [38.314816, -76.548947],
                        [38.31546, -76.552653],
                        [38.316639, -76.55233],
                        [38.316016, -76.5486],
                    ])
                )
            );
            // Competition Left Waypoints - typical competition waypoints with altitude

        } else if (selected == "Competition_Right") {
            setDefaultView([38.314666970000744, -76.54975138401012]);
            setMapData(
                new Map(
                    mapData.set(MapMode.FlightBound, [
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
                    ])
                )
            );
            setMapData(
                new Map(
                    mapData.set(MapMode.SearchBound, [
                        [38.314529, -76.545859], //bl
                        [38.314228, -76.544156], //br
                        [38.314441, -76.544081], //tr
                        [38.314731, -76.545792], //tl
                    ])
                )
            );
            setMapData(
                new Map(
                    mapData.set(MapMode.MappingBound, [
                        [38.314669, -76.547987],
                        [38.315873, -76.547611],
                        [38.315208, -76.54384],
                        [38.314008, -76.544237],
                    ])
                )
            );
            // Competition Right Waypoints - typical competition waypoints with altitude
            setMapData(
                new Map(
                    mapData.set(MapMode.Waypoint, [
                        [38.3159728, -76.5481119, 68.58], // Runway 2 Waypoint 1 (225ft -> 68.58m)
                        [38.3177991, -76.5475429, 68.58], // Runway 2 Waypoint 2 (225ft -> 68.58m)
                        [38.3175435, -76.5457284, 68.58], // Runway 2 Waypoint 3 (225ft -> 68.58m)
                        [38.3163228, -76.5448165, 68.58], // Runway 2 Waypoint 4 (225ft -> 68.58m)
                        [38.3172741, -76.5509426, 68.58], // Runway 2 Waypoint 5 (225ft -> 68.58m)
                        [38.3162977, -76.5492742, 68.58], // Runway 2 Waypoint 6 (225ft -> 68.58m)
                        [38.3150939, -76.5416300, 68.58], // Runway 2 Waypoint 7 (225ft -> 68.58m)
                        [38.3139321, -76.5435289, 68.58], // Runway 2 Waypoint 8 (225ft -> 68.58m)
                        [38.3157505, -76.5540862, 68.58], // Runway 2 Waypoint 9 (225ft -> 68.58m)
                        [38.3180653, -76.5498269, 68.58], // Runway 2 Waypoint 10 (225ft -> 68.58m)
                        [38.3178044, -76.5477133, 68.58], // Runway 2 Waypoint 11 (225ft -> 68.58m)
                        [38.3159996, -76.5482839, 68.58], // Runway 2 Waypoint 12 (225ft -> 68.58m)
                    ])
                )
            );
        } else {
            setMapData(new Map(mapData.set(MapMode.FlightBound, [])));
            setMapData(new Map(mapData.set(MapMode.SearchBound, [])));
            setMapData(new Map(mapData.set(MapMode.MappingBound, [])));
            setMapData(new Map(mapData.set(MapMode.Waypoint, [])));
        }
    }

    useEffect(() => {
        openModal();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <MyModal modalVisible={modalVisible} closeModal={closeModal}>
                <h1>IMPORTANT NOTE</h1>
                <p>
                    Make sure to input the search zone only with 4 coordinates
                    and in the following order
                </p>
                <p>
                    bottom left &gt; bottom right &gt; top right &gt; top left
                </p>
                <fieldset>
                    <legend>Default Location</legend>
                    <label>
                        <input
                            type="radio"
                            name="default_location"
                            value="Black_Mountain"
                            onClick={() =>
                                changingDeafultView("Black_Mountain")
                            }
                        />
                        Black Mountain
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="default_location"
                            value="Competition_Left"
                            onClick={() =>
                                changingDeafultView("Competition_Left")
                            }
                        />
                        Competition Left
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="default_location"
                            value="Competition_Right"
                            onClick={() =>
                                changingDeafultView("Competition_Right")
                            }
                        />
                        Competition Right
                    </label>
                </fieldset>
            </MyModal>
            <main className="input-page">
                <TuasMap className="input-map" lat={51} lng={10}>
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
                    />
                    <AirdropInputForm
                        airdropAssignments={airdropAssignments}
                        setAirdropAssignments={setAirdropAssignments}
                    />
                    <form className="tuas-form input-controls">
                        <input
                            type="button"
                            onClick={submitMission}
                            value="Submit"
                        ></input>
                        <input
                            type="button"
                            onClick={requestPath}
                            value="Get Generated Path"
                        ></input>
                        <input
                            type="button"
                            onClick={validatePath}
                            value="Validate Path"
                        ></input>
                        <input
                            type="button"
                            onClick={generateNewPath}
                            value="Generate New Path"
                        ></input>
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
