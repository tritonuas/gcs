import React from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import "./Control.css"

type Unit = 'knots' | 'm/s' | 'feet' | 'meters' | 'V' | '°F' | '°C' | '';

class Parameter {
    values: number[];
    units: Unit[];
    unit: Unit;
    color: React.CSSProperties;
    value: number;

    constructor(values: number[], units: Unit[], color: React.CSSProperties) {
        this.values = values;
        this.units = units;
        this.unit = unitRandomeizer(units);
        this.value = this.values[units.indexOf(this.unit)];
        this.color = color;
    }
}

function unitRandomeizer(units: Unit[]): Unit {
    const randomIndex = Math.floor(Math.random() * units.length);
    return units[randomIndex];
}

function Control() {
    const randomColor = () => {
        const colors = ['var(--success-text)', 'var(--failure-text)'];
        const randomIndex = Math.floor(Math.random() * colors.length);
        let color = colors[randomIndex];
        return color;
    };

    const generateColor = (): React.CSSProperties => {
        return { backgroundColor: randomColor() };
    };
    
    let airspeed = new Parameter([120, parseFloat((120*1.94384).toFixed(2))], ['knots', 'm/s'], generateColor());
    let groundspeed = new Parameter([120, parseFloat((120*1.94384).toFixed(2))], ['knots', 'm/s'], generateColor());
    let altitudeMSL = new Parameter([120, parseFloat((120*0.3048).toFixed(2))], ['feet', 'meters'], generateColor());
    let altitudeAGL = new Parameter([120, parseFloat((120*0.3048).toFixed(2))], ['feet', 'meters'], generateColor());
    let motorBattery = new Parameter([120], ['V'], generateColor());
    let pixhawkBattery = new Parameter([120], ['V'], generateColor());
    let ESCtemperature = new Parameter([120, parseFloat(((120 - 32)*(5/9)).toFixed(2))], ['°F', '°C'], generateColor());
    
    let flightMode = 'idk';
    let flightModeColor = generateColor();
    
    return (
        <>
            <main className="controls-page">
                <div className="flight-telemetry-container">
                    <div className='flight-telemetry' id='compass'>
                        <h1>/*insert compass*/</h1>
                    </div>
                    <div style={airspeed.color} className='flight-telemetry' id='airspeed'>
                        <h1>Airspeed</h1>
                        <p className='data'>{airspeed.value} {airspeed.unit}</p>
                    </div>
                    <div style={groundspeed.color} className='flight-telemetry' id='groundspeed'>
                        <h1>Groundspeed</h1>
                        <p className='data'>{groundspeed.value} {groundspeed.unit}</p>
                    </div>
                    <div style={altitudeMSL.color} className='flight-telemetry' id='altitudeMSL'>
                        <h1>Altitude MSL</h1>
                        <p className='data'>{altitudeMSL.value} {altitudeMSL.unit}</p>
                    </div>
                    <div style={altitudeAGL.color} className='flight-telemetry' id='altitudeAGL'>
                        <h1>Altitude AGL</h1>
                        <p className='data'>{altitudeAGL.value} {altitudeAGL.unit}</p>
                    </div>
                </div>
                <MapContainer className={"map"} center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
                    <TileLayer
                        attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
                        url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
                        accessToken="pk.eyJ1IjoidGxlbnR6IiwiYSI6ImNsM2dwNmwzczBrb24zaXcxcWNoNWZjMjQifQ.sgAV6vkF7vOLC4P1_WkV_w"
                        tileSize={512}
                        zoomOffset={-1}
                        id= 'mapbox/satellite-v9'
                    />
                    <Marker position={[51.505, -0.09]}>
                        <Popup>
                        A pretty CSS3 popup. <br /> Easily customizable.
                        </Popup>
                    </Marker>
                </MapContainer>
                <div className="flight-telemetry-container">
                    <div style={flightModeColor} className='flight-telemetry' id='flight-mode'>
                        <h1>Flight Mode</h1>
                        <p className='data'>{flightMode}</p>
                    </div>
                    <div style={motorBattery.color} className='flight-telemetry' id='motor-battery'>
                        <h1>Motor Battery</h1>
                        <p className='data'>{motorBattery.value} {motorBattery.unit}</p>
                    </div>
                    <div style={pixhawkBattery.color} className='flight-telemetry' id='pixhawk-battery'>
                        <h1>Pixhawk Battery</h1>
                        <p className='data'>{pixhawkBattery.value} {pixhawkBattery.unit}</p>
                    </div>
                    <div style={ESCtemperature.color} className='flight-telemetry' id='ESC-temperature'>
                        <h1>ESC Temperature</h1>
                        <p className='data'>{ESCtemperature.value} {ESCtemperature.unit}</p>
                    </div>
                </div>
            </main>
        </>
    );
}

export default Control;