import { SetStateAction, useState } from 'react';

import {useMapEvents, Polygon, Polyline} from "react-leaflet"

import './Input.css';
import TuasMap from '../components/TuasMap';
import { LatLng } from 'leaflet';

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
                                {
                                    row.map((num, j) => {
                                        return (
                                            <td key={j}>
                                                <input
                                                    type="number" 
                                                    key={mapMode}
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
                            onClick={() => {
                                setMapData(mapData => {
                                    const data = mapData.get(mapMode);
                                    const headingLength = getModeConfig(mapMode).headings.length;

                                    if (data !== undefined) {
                                        data.push(new Array(headingLength));
                                        mapData.set(mapMode, data);
                                        return new Map(mapData);
                                    }
                                    return new Map(); // this should never happen
                                });
                            }}
                            />
                        <input
                            type="button"
                            value="-"
                            onClick={() => {
                                
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
 * @returns Bottle Input Form
 */
function BottleInputForm() {
    return (
        <>
            <form className="tuas-form">
                <fieldset>
                    <legend>Bottle Input</legend>
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
    const [mapMode, setMapMode] = useState<MapMode>(MapMode.FlightBound);
    const [mapData, setMapData] = useState<Map<MapMode,number[][]>>(new Map());

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
                    <BottleInputForm />
                </div>
            </main>
        </>
    );
}

export default Input;