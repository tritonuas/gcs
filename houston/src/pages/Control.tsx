import React, { useState } from 'react';
import TuasMap from '../components/TuasMap.tsx'
import "./Control.css"

type Unit = 'knots' | 'm/s' | 'feet' | 'meters' | 'V' | '°F' | '°C' | '';

class Parameter {
    values: number[];
    value: number;
    units: Unit[];
    unit: Unit;
    color: React.CSSProperties;

    // threshold: 
    // - length = 4
    // - format: [lower bound value for unit[0], upper bound value for unit[0], lower bound value for unit[1], upper bound value for unit[1]]
    // - use: 
    //      - to determine the color of the telemetry based on the current and threshold values. 
    //      - if the current value is within the threshold, the color is green. if not, the color is red.
    threshold: number[]; 

    // index:
    // - use: -
    //      - to determine which unit to display.
    //      - if the index is 0, display the value in unit[0]. if the index is 1, display the value in unit[1].
    //      - value of index is toggled when the telemetry is clicked, which is handled by the handleClick function.
    index: number;

    constructor(values: number[], units: Unit[], threshold: number[], index: number) {
        this.values = values;
        this.units = units;
        this.value = values[index];
        this.unit = this.units[values.indexOf(this.value)];
        this.threshold = threshold;
        this.color = colorDeterminer(this.values, this.value, this.threshold);
        this.index = index;
    }
}

/**
 * airspeed and groundspeed randomizer function for testing
 * @returns the middle value of the array and its unit converted to the corresponding unit as a tuple
 */
function valueRandomizer() { 
    const number = [60, 120, 240];
    // const randomIndex = Math.floor(Math.random() * number.length);
    return ([number[1], parseFloat((number[1]*1.94384).toFixed(2))]);
}

/**
 * altitude randomizer function for testing
 * @returns the middle value of the array and its unit converted to the corresponding unit as a tuple
 */
function valueRandomizer2() { 
    const number = [60, 120, 240];
    // const randomIndex = Math.floor(Math.random() * number.length);
    return ([number[1], parseFloat((number[1]*0.3048).toFixed(2))]);
}

/**
 * ESC temperature randomizer function for testing
 * @returns the middle value of the array and its unit converted to the corresponding unit as a tuple
 */
function valueRandomizer3() { 
    const number = [60, 120, 240];
    // const randomIndex = Math.floor(Math.random() * number.length);
    return ([number[1], parseFloat(((number[1]-32) * (5/9)).toFixed(2))]);
}

/**
 * battery randomizer function for testing
 * @returns the middle value of the array twice to make implementation and logic easier
 */
function valueRandomizer4() { 
    const number = [60, 120, 240];
    // const randomIndex = Math.floor(Math.random() * number.length);
    return ([number[1], number[1]]);
}

/**
 * color determiner function for testing
 * @param values - the tuple of values
 * @param value - the value of the telemetry
 * @param threshold - the tuple of threshold values
 * @returns - the color of the telemetry based on the current and threshold values
 */
function colorDeterminer(values : number[], value : number, threshold : number[]) {
    if (value >= threshold[(values.indexOf(value)) * 2] && value <= threshold[(values.indexOf(value)) * 2 + 1]) {
        return { backgroundColor: 'var(--success-text)' };
    }
    else {
        return { backgroundColor: 'var(--failure-text)' };
    }
}

interface TelemetryProps {
    key: number;
    heading: string;
    color: React.CSSProperties;
    value: number;
    units: Unit[];
    unit: Unit;
    onClick: () => void;
}

/**
 * Telemetry component
 * @param props - the props of the telemetry
 * @param props.key - the key of the telemetry
 * @param props.heading - the heading of the telemetry
 * @param props.color - the color of the telemetry
 * @param props.value - the value of the telemetry
 * @param props.units - the units of the telemetry
 * @param props.unit - the current unit of the telemetry
 * @param props.onClick - the onClick function of the telemetry
 * @returns the telemetry component
 */
function TelemetryGenerator({ key, heading, color, value, units, unit, onClick }: TelemetryProps) {
    let unit0_color = { backgroundColor: '#808080' };
    let unit1_color = { backgroundColor: 'var(--secondary-text)' };
    if (units[0] !== units[1]) {
        if (unit === units[0]) {
            unit0_color = { backgroundColor: 'var(--highlight)' };
            unit1_color = { backgroundColor: '#808080' };
        } else {
            unit0_color = { backgroundColor: '#808080' };
            unit1_color = { backgroundColor: 'var(--highlight)' };
        }
        return (
            <div key={key} style={color} className='flight-telemetry' onClick={onClick}>
                <h1 className='heading'>{heading}</h1>
                <p className='data'>{value} {unit}</p>
                <div className='unit-indicator'>
                    <p className='unit' style={unit0_color}>{units[0]}</p>
                    <p className='unit' style={unit1_color}>{units[1]}</p>
                </div>
            </div>
        );
    } else {
        return (
            <div key={key} style={color} className='flight-telemetry' onClick={onClick}>
                <h1 className='heading'>{heading}</h1>
                <p className='data'>{value} {unit}</p>
            </div>
        );
    }
}

/**
 * control page
 * @returns the control page
 */ 
function Control() {
    const [index, setIndex] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

    const handleClick = (key : number) => {
        setIndex(prevIndices => {
            const newIndices = [...prevIndices];
            newIndices[key] = newIndices[key] === 0 ? 1 : 0;
            return newIndices;
        });
    };

    const airspeedVal = valueRandomizer();
    const groundspeedVal = valueRandomizer();
    const altitudeMSLVal = valueRandomizer2();
    const altitudeAGLVal = valueRandomizer2();
    const motorBatteryVal = valueRandomizer4();
    const pixhawkBatteryVal = valueRandomizer4();
    const ESCtemperatureVal = valueRandomizer3();

    const airspeedThreshold = [80, 160, parseFloat((80*1.94384).toFixed(2)), parseFloat((160*1.94384).toFixed(2))];
    const groundspeedThreshold = [80, 160, parseFloat((80*1.94384).toFixed(2)), parseFloat((160*1.94384).toFixed(2))];
    const altitudeMSLThreshold = [80, 160, parseFloat((80*0.3048).toFixed(2)), parseFloat((160*0.3048).toFixed(2))];
    const altitudeAGLThreshold = [80, 160, parseFloat((80*0.3048).toFixed(2)), parseFloat((160*0.3048).toFixed(2))];
    const motorBatteryThreshold = [80, 160, 80, 160];
    const pixhawkBatteryThreshold = [80, 160, 80, 160];
    const ESCtemperatureThreshold = [80, 160, parseFloat(((80-32) * (5/9)).toFixed(2)), parseFloat(((160-32) * (5/9)).toFixed(2))];

    const airspeed = new Parameter(airspeedVal, ['knots', 'm/s'], airspeedThreshold, index[0]);
    const groundspeed = new Parameter(groundspeedVal, ['knots', 'm/s'], groundspeedThreshold, index[1]);
    const altitudeMSL = new Parameter(altitudeMSLVal, ['feet', 'meters'], altitudeMSLThreshold, index[2]);
    const altitudeAGL = new Parameter(altitudeAGLVal, ['feet', 'meters'], altitudeAGLThreshold, index[3]);
    const motorBattery = new Parameter(motorBatteryVal, ['V', 'V'], motorBatteryThreshold, index[4]);
    const pixhawkBattery = new Parameter(pixhawkBatteryVal, ['V', 'V'], pixhawkBatteryThreshold, index[5]);
    const ESCtemperature = new Parameter(ESCtemperatureVal, ['°F', '°C'], ESCtemperatureThreshold, index[6]);
    
    const flightMode = 'idk';
    const flightModeColor = { backgroundColor: 'var(--highlight)' };
    
    return (
        <>
            <main className="controls-page">
                <div className="flight-telemetry-container">
                    <div className='flight-telemetry' id='compass'>
                        <h1 className='heading'>*insert compass*</h1>
                    </div>
                    <TelemetryGenerator key={0} heading='Airspeed' color={airspeed.color} value={airspeed.value} units={airspeed.units} unit={airspeed.unit} onClick={() => handleClick(0)}/>
                    <TelemetryGenerator key={1} heading='Groundspeed' color={groundspeed.color} value={groundspeed.value} units={groundspeed.units} unit={groundspeed.unit} onClick={() => handleClick(1)}/>
                    <TelemetryGenerator key={2} heading='Altitude MSL' color={altitudeMSL.color} value={altitudeMSL.value} units={altitudeMSL.units} unit={altitudeMSL.unit} onClick={() => handleClick(2)}/>
                    <TelemetryGenerator key={3} heading='Altitude AGL' color={altitudeAGL.color} value={altitudeAGL.value} units={altitudeAGL.units} unit={altitudeAGL.unit} onClick={() => handleClick(3)}/>
                </div>
                <TuasMap className={'map'} lat={1.3467} lng={103.9326} popupArray={[]} icons={[]}/>
                <div className="flight-telemetry-container">
                    <div style={flightModeColor} className='flight-telemetry' id='flight-mode'>
                        <h1 className='heading'>Flight Mode</h1>
                        <p className='data'>{flightMode}</p>
                    </div>
                    <TelemetryGenerator key={4} heading='Motor Battery' color={motorBattery.color} value={motorBattery.value} units={motorBattery.units} unit={motorBattery.unit} onClick={() => handleClick(4)}/>
                    <TelemetryGenerator key={5} heading='Pixhawk Battery' color={pixhawkBattery.color} value={pixhawkBattery.value} units={pixhawkBattery.units} unit={pixhawkBattery.unit} onClick={() => handleClick(5)}/>
                    <TelemetryGenerator key={6} heading='ESC Temperature' color={ESCtemperature.color} value={ESCtemperature.value} units={ESCtemperature.units} unit={ESCtemperature.unit} onClick={() => handleClick(6)}/>
                </div>
            </main>
        </>
    );
}

export default Control;