import { SetStateAction, useState, useEffect } from 'react';

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

function FormTable(
    {headings, mapMode, mapData, setMapData}:
    {
        headings: string[], 
        mapMode: MapMode,
        mapData: Map<MapMode, number[][]>, 
        setMapData: React.Dispatch<SetStateAction<Map<MapMode, number[][]>>>
    }
) {
    const data = mapData.get(mapMode);

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
                        data?.map((row, i) => {
                            return (
                                <tr key={i}>
                                {
                                    row.map((num, j) => {
                                        return (
                                            <td key={j}>
                                                <input type="number" step="any" defaultValue={num} onChange={(e) => {
                                                    let newData = data;
                                                    newData[i][j] = Number(e.target.value);
                                                    setMapData(mapData.set(mapMode, newData));
                                                }}/>
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
                    <div>
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
            let newData = mapData.get(mapMode);
            if (newData === undefined) {
                newData = [];
            }
            if (config.headings.length == 2) {
                newData?.push([e.latlng.lat, e.latlng.lng])
            } else {
                newData?.push([e.latlng.lat, e.latlng.lng, 75]); // fill in 75ft for alt
            }
            setMapData(new Map(mapData.set(mapMode, newData)));
        }
    }) 

    return (
        <>
            {null}
        </>
    );
}

function MapIllustrator(
    {mapMode, mapData}:
    {
        mapMode: MapMode,
        mapData: Map<MapMode, number[][]>
    }
) {
    return (
        <>
        {
            Array.from(mapData).map(([mode, currData], i) => {
                const currConfig = getModeConfig(mode);

                const parsedData = currData.map((latlng) => new LatLng(latlng[0], latlng[1]));

                switch (currConfig.type) {
                    case ShapeType.Line:
                        return (
                            <Polyline key={i} color={currConfig.color} positions={parsedData} />
                        );
                    case ShapeType.Polygon:
                        return (
                            <Polygon key={i} color={currConfig.color} positions={[parsedData]} />
                        );
                }
            })
        }
        </>
    );
}

/**
 * 
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
                    <MapIllustrator mapMode={mapMode} mapData={mapData}/>
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