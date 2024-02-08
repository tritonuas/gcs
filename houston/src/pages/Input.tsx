import { SetStateAction, useState, useEffect, ChangeEvent } from 'react';

import {useMapEvents, Polygon, Polyline} from "react-leaflet"

import './Input.css';
import TuasMap from '../components/TuasMap';
import { LatLng } from 'leaflet';
import { Bottle, BottleDropIndex, GPSCoord, Mission, ODLCColor, ODLCShape } from '../protos/obc.pb';


enum MapMode {
    FlightBound,
    SearchBound,
    Waypoint
}

enum ShapeType {
    Line,
    Polygon
}

interface MapModeConfig {
    color: string,
    headings: string[],
    type: ShapeType,
}

const getModeConfig = (mapMode: MapMode) => {
    switch (mapMode) {
        case MapMode.FlightBound:
            return {
                color: "red",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Polygon
            } as MapModeConfig;
        case MapMode.SearchBound:
            return {
                color: "blue",
                headings: ["Latitude", "Longitude"],
                type: ShapeType.Polygon
            } as MapModeConfig;
        case MapMode.Waypoint:
            return {
                color: "yellow",
                headings: ["Latitude", "Longitude", "Altitude"],
                type: ShapeType.Line
            } as MapModeConfig;
    }
}

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
function FormTable(
    {headings, mapMode, mapData, setMapData}:
    {
        headings: string[], 
        mapMode: MapMode,
        mapData: Map<MapMode, number[][]>, 
        setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>,
    }
) {
    // add extra left column for the X button
    headings = ["---"].concat(headings);

    return (
        <>
            <table>
                <thead>
                    <tr>
                        {headings.map((str, i) => <th key={i}>{str}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {
                        mapData.get(mapMode)?.map((row, i) => {
                            return (
                                <tr key={i}>
                                    <td>
                                        <input
                                            type="button"
                                            className="del-btn"
                                            value="X"
                                            onClick={() => {
                                                const data = mapData.get(mapMode);

                                                setMapData(mapData => {
                                                    if (data !== undefined) {
                                                        const temp = (data.slice(0, i).concat(data.slice(i+1)));
                                                        console.log(temp);
                                                        return new Map(mapData.set(mapMode, temp));
                                                    } else {
                                                        return mapData; // should never happen
                                                    }
                                                });
                                            }}
                                            />
                                    </td>
                                {
                                    row.map((num, j) => {
                                        return (
                                            <td key={j}>
                                                <input
                                                    type="number" 
                                                    key={mapMode.toString() + (mapData.get(mapMode)?.at(i)?.at(j))}
                                                    step="any" 
                                                    defaultValue={num} 
                                                    onChange={(e) => {
                                                        const newArr = mapData.get(mapMode);
                                                        if (newArr == undefined) {
                                                            return;
                                                        }
                                                        newArr[i][j] = Number(e.target.value);
                                                        setMapData(new Map(mapData.set(mapMode, newArr)));
                                                    }}
                                                    />
                                            </td>
                                        )
                                    })
                                }
                                </tr>  
                            ) 
                        })
                    }
                </tbody>
            </table>
        </>
    )
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
function MapInputForm(
    {mapMode, setMapMode, mapData, setMapData}:
    {
        mapMode:MapMode, 
        setMapMode: React.Dispatch<SetStateAction<MapMode>>, 
        mapData: Map<MapMode, number[][]>, 
        setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>,
    }
) {

    return (
        <>
            <form className="tuas-form">
                <fieldset>
                    <legend>Map Input</legend>
                    <div className="button-container">
                        {
                            Object.keys(MapMode).filter((v => isNaN(Number(v)))).map((v, i) => {
                                return (
                                    <input 
                                        key={i} 
                                        data-selected={mapMode == MapMode[v as keyof typeof MapMode]}
                                        type="button" 
                                        value={v} 
                                        onClick={() => {
                                            setMapMode(MapMode[v as keyof typeof MapMode]);
                                        }}
                                        />
                                )
                            })
                        }
                        <input
                            type="button"
                            value="+"
                            className="add-btn"
                            onClick={() => {
                                const data = mapData.get(mapMode);
                                const headingLength = getModeConfig(mapMode).headings.length;
                                const newRow = new Array(headingLength).fill(0);

                                setMapData(mapData => {
                                    if (data !== undefined) {
                                        return new Map(
                                            mapData.set(mapMode, data.concat([newRow]))
                                        );
                                    } else {
                                        return new Map(mapData.set(mapMode, [newRow]));
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

                                 setMapData(mapData => {
                                    if (data !== undefined && data.length > 0) {
                                        return new Map(mapData.set(mapMode, data.slice(0, -1)));
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
 * Form that handles all the input for entering bottle loading information
 * on the plane for the mission
 * @param props props
 * @param props.bottleAssignments The list of current entered bottle assignments
 * @param props.setBottleAssignments State setter for props.bottleAssignments
 * @returns Bottle Input Form
 */
function BottleInputForm(
    {bottleAssignments, setBottleAssignments}:
    {bottleAssignments: Bottle[], setBottleAssignments: React.Dispatch<SetStateAction<Bottle[]>>}
) {
    /**
     * @returns Every possible ODLC Color represented as an <option> HTML element, to be 
     * placed inside of a <select> element.
     */
    function mapColorsToOptions() {
        return (Object.keys(ODLCColor) as unknown as Array<ODLCColor>)
            .filter((color) => {
                return isNaN(Number(color));
            })
            .map((color) => {
                return (<>
                    <option key={color} value={color}>{color}</option>
                </>);
            });
    }
    /**
     * @returns Every possible ODLC Shape represented as an <option> HTML element, to be 
     * placed inside of a <select> element.
     */
    function mapShapesToOptions() {
        return (Object.keys(ODLCShape) as unknown as Array<ODLCShape>)
            .filter((shape) => {
                return isNaN(Number(shape));
            })
            .map((shape) => {
                return (<>
                    <option key={shape} value={shape}>{shape}</option>
                </>);
            });
    }

    const bottleInput = (bottle: Bottle) => {
        return (
            <>
                <fieldset key={bottle.Index}>
                    <legend>Bottle {bottle.Index.toString()}</legend>
                    <label>
                       Mannequin 
                        <input
                            type="checkbox"
                            defaultChecked={bottle.IsMannikin}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                bottle.IsMannikin = e.currentTarget.checked;
                                // force state change so inputs below get rerendered as disabled
                                setBottleAssignments(bottleAssignments.map(e => e));    
                            }}
                            />
                    </label>
                    <label>
                        Alphanumeric: 
                        <input 
                            maxLength={1} 
                            defaultValue={bottle.Alphanumeric}
                            disabled={bottle.IsMannikin}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                bottle.Alphanumeric = e.currentTarget.value;
                            }}
                            />
                    </label>
                    <label>
                        Alphanumeric Color:
                        <select onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            bottle.AlphanumericColor = e.currentTarget.value as unknown as ODLCColor;
                        }}
                            disabled={bottle.IsMannikin}
                            >
                            {mapColorsToOptions()}
                        </select>
                    </label>
                    <label>
                        Shape: 
                        <select onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            bottle.Shape = e.currentTarget.value as unknown as ODLCShape;
                        }} 
                            disabled={bottle.IsMannikin}
                            >
                            {mapShapesToOptions()}
                        </select>
                    </label>
                    <label>
                        Shape Color: 
                        <select onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            bottle.ShapeColor = e.currentTarget.value as unknown as ODLCColor;
                        }}
                            disabled={bottle.IsMannikin}
                            >
                            {mapColorsToOptions()}
                        </select>
                    </label>
                </fieldset>
            </>
        );
    }

    useEffect(() => {
        const bottles = [];
        for (let i = BottleDropIndex.A; i <= BottleDropIndex.E; i++) {
            const bottle = {
                Alphanumeric: "",
                AlphanumericColor: ODLCColor.UnspecifiedColor,
                Shape: ODLCShape.UnspecifiedShape,
                ShapeColor: ODLCColor.UnspecifiedColor,
                Index: i,
                IsMannikin: false
            } as Bottle;
            bottles.push(bottle);
        }
        setBottleAssignments(bottles);
    }, [setBottleAssignments]);

    return (
        <>
            <form className="tuas-form" >
                <fieldset>
                    <legend>Bottle Input</legend>
                    <div className="bottle-form-container">
                        {bottleAssignments.map((bottle) => bottleInput(bottle))}
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
function MapClickHandler(
    {mapMode, mapData, setMapData}:
    {
        mapMode: MapMode
        mapData: Map<MapMode, number[][]>, 
        setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>,
    }
) {
    useMapEvents({
        click(e) {
            const config = getModeConfig(mapMode);

            // Update the data state variable
            let data = mapData.get(mapMode);
            if (data == undefined) {
                data = [];
            }

            const newData = (() => {
                if (config.headings.length == 2) {
                    return [...data, [e.latlng.lat, e.latlng.lng]];
                } else {
                    return [...data, [e.latlng.lat, e.latlng.lng, 75]];// fill in 75 for default alt 
                }
            })();

            setMapData(new Map(mapData.set(mapMode, newData)));
        }
    }) 

    return (
        <>
            {null}
        </>
    );
}

/**
 * Component that is placed inside of the leaflet map and renders the relevant
 * polygons and lines from the state variable.
 * @param props Props
 * @param props.mapData current map data so that it can draw the right shapes
 * @returns MapIllustrator
 */
function MapIllustrator(
    {mapData}:
    {
        mapData: Map<MapMode, number[][]>
    }
) {
    return (
        <>
        {
            Array.from(mapData).map(([mode, currData]) => {
                const currConfig = getModeConfig(mode);
                const parsedData = currData.map((latlng) => new LatLng(latlng[0], latlng[1]));

                switch (currConfig.type) {
                    case ShapeType.Line:
                        return (
                            <Polyline key={JSON.stringify(parsedData)} color={currConfig.color} positions={parsedData} />
                        );
                    case ShapeType.Polygon:
                        return (
                            <Polygon key={JSON.stringify(parsedData)} color={currConfig.color} positions={[parsedData]} />
                        );
                }
            })
        }
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
    const [mapData, setMapData] = useState<Map<MapMode,number[][]>>(new Map());
    const [bottleAssignments, setBottleAssignments] = useState<Bottle[]>([]);

    /**
     * Takes the current state of all the inputs and posts to Hub
     */
    function submitMission() {
        const mapDataToGpsCoords = (mode: MapMode) => {
            const config = getModeConfig(mode);
                    
            return mapData.get(mode)?.map((row) => {
                return ({
                    Latitude: row[config.headings.indexOf("Latitude")],
                    Longitude: row[config.headings.indexOf("Longitude")],
                    Altitude: row[config.headings.indexOf("Altitude")],
                } as GPSCoord);
            }) || [];
        };

        const mission: Mission = {
            BottleAssignments: bottleAssignments,
            FlightBoundary: mapDataToGpsCoords(MapMode.FlightBound),
            AirdropBoundary: mapDataToGpsCoords(MapMode.SearchBound),
            Waypoints: mapDataToGpsCoords(MapMode.Waypoint),
        };

        console.log(mission);

        fetch("/api/mission", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(mission)
        })
            .then(response => {
                if (response.status == 200) {
                    return response.text();
                } else {
                    throw response.text();
                }
            })
            .then(succ_msg => {
                alert(succ_msg);
            })
            .catch(err_msg => {
                alert(err_msg);
            });
    }

    return (
        <>
            <main className="input-page">
                <TuasMap className="input-map" lat={51} lng={10}>
                    <MapClickHandler mapMode={mapMode} mapData={mapData} setMapData={setMapData}/>
                    <MapIllustrator mapData={mapData}/>
                </TuasMap>
                <div className="right-container">
                    <MapInputForm 
                        mapMode={mapMode} 
                        setMapMode={setMapMode}
                        mapData={mapData}
                        setMapData={setMapData}
                        />
                    <BottleInputForm 
                        bottleAssignments={bottleAssignments} 
                        setBottleAssignments={setBottleAssignments}
                        />
                    <form className="tuas-form">
                        <input type="button" onClick={submitMission} value="Submit"></input>
                    </form>
                </div>
            </main>
        </>
    );
}

export default Input;