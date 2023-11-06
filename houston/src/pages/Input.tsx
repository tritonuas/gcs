import { SetStateAction, useState } from 'react';

import './Input.css';
import TuasMap from '../components/TuasMap';

enum MapMode {
    FlightBound,
    SearchBound,
    Waypoint
}

function FormTable(
    {headings, data, setData}:
    {headings: string[], data: Array<Array<number>>, setData: React.Dispatch<SetStateAction<Array<Array<number>>>>}
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
                        data.map((row, i) => {
                            return (
                                <tr key={i}>
                                {
                                    row.map((num, j) => {
                                        return (
                                            <td key={j}>
                                                <input type="number" step="any" defaultValue={num} onChange={(e) => {
                                                    let newData = data;
                                                    newData[i][j] = Number(e.target.value);
                                                    setData(newData);
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
function MapInputForm({mapMode, setMapMode}:{mapMode:MapMode, setMapMode: React.Dispatch<SetStateAction<MapMode>>}) {
    const testData = [
        [1, 2, 3],
        [4, 5, 6]
    ];
    const [data, setData] = useState(testData);
    
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
                    <FormTable headings={["Latitude", "Longitude", "Altitude"]} data={data} setData={setData}/>
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
 * 
 * @returns Input page
 */
function Input() {
    const [mapMode, setMapMode] = useState<MapMode>(MapMode.FlightBound);
    return (
        <>
            <main className="input-page">
                <TuasMap className="input-map" lat={51} lng={10}/>
                <div className="right-container">
                    <MapInputForm mapMode={mapMode} setMapMode={setMapMode}/>
                    <BottleInputForm />
                </div>
            </main>
        </>
    );
}

export default Input;