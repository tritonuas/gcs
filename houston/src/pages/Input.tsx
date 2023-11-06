import { useState } from 'react';

import './Input.css';
import TuasMap from '../components/TuasMap';

enum MapMode {
    FlightBound,
    SearchBound,
    Waypoint
}

/**
 * Form that contains all of the controls for entering flight boundary, search boundary,
 * and waypoint data for the mission
 * @returns Map Input Form
 */
function MapInputForm() {
    const [mapMode, setMapMode] = useState<MapMode>(MapMode.FlightBound);

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
    return (
        <>
            <main className="input-page">
                <TuasMap className="input-map" lat={51} lng={10}/>
                <div className="right-container">
                    <MapInputForm />
                    <BottleInputForm />
                </div>
            </main>
        </>
    );
}

export default Input;