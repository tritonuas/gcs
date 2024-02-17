import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import TuasMap from '../components/TuasMap.tsx'
import "./Control.css"
import { pullTelemetry } from '../utilities/pull_telemetry.ts';
import NOOOO from "../assets/noooo.gif"
import { SuperSecret } from '../components/SuperSecret.tsx';
import { CELSIUS_TO_FAHRENHEIT, FAHRENHEIT_TO_CELSIUS, FEET_TO_METERS, METERS_PER_SECOND_TO_KNOTS, roundDecimal } from '../utilities/general.tsx';
import { SettingsConfig} from "./Settings.tsx";

type Unit = 'knots' | 'm/s' | 'feet' | 'meters' | 'V' | 'V/c' | '°F' | '°C' | '';
export type Threshold = [number, number, number, number];

export class Parameter {
    label: String;
    values: [number, number];
    value: number;
    units: [Unit, Unit];
    unit: Unit;
    color: React.CSSProperties;
    index: 0 | 1;
    error: boolean;

    // threshold: 
    // - length = 4
    // - format: [lower bound value for unit[0], upper bound value for unit[0], lower bound value for unit[1], upper bound value for unit[1]]
    // - use: 
    //      - to determine the color of the telemetry based on the current and threshold values. 
    //      - if the current value is within the threshold, the color is green. if not, the color is red.
    threshold: Threshold;

    constructor(label: String, values: [number, number], units: [Unit, Unit], threshold: Threshold, index: 0 | 1, error: boolean = false) {
        this.label = label;
        this.values = values;
        this.units = units;
        this.value = values[index];
        this.unit = units[index];
        this.index = index;
        this.error = error;

        this.threshold = threshold;

        // figure out color 
        // todo refactor
        if (this.error) {
            this.color = { backgroundColor: 'var(--failure-text)' };
        } else {
            if (this.value >= threshold[(values.indexOf(this.value)) * 2] && this.value <= threshold[(values.indexOf(this.value)) * 2 + 1]) {
                this.color = { backgroundColor: 'var(--success-text)' };
            }
            else {
                this.color = { backgroundColor: 'var(--warning-text)' };
            }
        }
    }

    render(onClick: () => void) {
        if (this.error) {
            return (
                <div style={this.color} className='flight-telemetry' onClick={onClick}>
                    <h1 className='heading'>{this.label}</h1>
                    <p className='data'> <img className="error-icon" width={80} height={80} src={NOOOO}/></p>
                    <div className='unit-indicator'>
                    </div>
                </div>
            );
        }

        if (this.units[0] !== this.units[1]) {
            let unit0_class = 'unit-selected';
            let unit1_class = 'unit-not-selected';

            if (this.unit !== this.units[0]) {
                [unit0_class, unit1_class] = [unit1_class, unit0_class]; // swap
            }

            return (
                <div style={this.color} className='flight-telemetry' onClick={onClick}>
                    <h1 className='heading'>{this.label}</h1>
                    <p className='data'>{roundDecimal(this.value)} {this.unit}</p>
                    <div className='unit-indicator'>
                        <p className={`unit ${unit0_class}`} >{this.units[0]}</p>
                        <p className={`unit ${unit1_class}`} >{this.units[1]}</p>
                    </div>
                </div>
            );
        } else {
            return (
                <div style={this.color} className='flight-telemetry' onClick={onClick}>
                    <h1 className='heading'>{this.label}</h1>
                    <p className='data'>{roundDecimal(this.value)} {this.unit}</p>
                </div>
            );
        }
    }

    // Swaps the unit, but keeps all else constant
    // Returns new Parameter for use in react setState
    // does not mutate this Parameter
    getSwappedUnit(): Parameter {
        return new Parameter(
            this.label,
            this.values,
            this.units,
            this.threshold,
            this.index === 0 ? 1 : 0,
            this.error,
        );
    }

    // Updates the values, but keeps all else constant
    // Returns new Parameter for use in react setState
    // does not mutate this Parameter
    // Also wipes any error state
    getUpdatedValue(new_val: number, convert: (arg0: number) => number): Parameter {
        return new Parameter(
            this.label,
            [new_val, convert(new_val)],
            this.units,
            this.threshold,
            this.index,
            false
        );
    }

    // Returns a parameter in the error state version of this Parameter
    // currently overrides the values to be 0,0 but maybe in the future
    // we will want to have it specified another way
    getErrorValue(): Parameter {
        return new Parameter(
            this.label,
            [0, 0],
            this.units,
            this.threshold,
            this.index,
            true
        );
    }
}

/**
 * control page
 * @returns the control page
 */ 
function Control({settings}:{settings: SettingsConfig}) {
    const airspeedThreshold: Threshold = [
        settings.minAirspeed_m_s,
        settings.maxAirspeed_m_s, 
        METERS_PER_SECOND_TO_KNOTS(settings.minAirspeed_m_s), 
        METERS_PER_SECOND_TO_KNOTS(settings.maxAirspeed_m_s)
    ];

    const groundspeedThreshold = airspeedThreshold;

    //todo figure out way to deteect starting altitude so this has a valid range too
    const altitudeAGLThreshold: Threshold = [
        settings.minAltitudeAGL_feet,
        settings.maxAltitudeAGL_feet,
        FEET_TO_METERS(settings.minAltitudeAGL_feet),
        FEET_TO_METERS(settings.maxAltitudeAGL_feet), 
    ];

    const altitudeMSLThreshold: Threshold = [
        settings.minAltitudeAGL_feet + settings.groundAltitude_feet,
        settings.maxAltitudeAGL_feet + settings.groundAltitude_feet,
        FEET_TO_METERS(settings.minAltitudeAGL_feet) + FEET_TO_METERS(settings.groundAltitude_feet),
        FEET_TO_METERS(settings.maxAltitudeAGL_feet) + FEET_TO_METERS(settings.groundAltitude_feet),
    ];

    const motorBatteryThreshold: Threshold = [
        settings.minVoltsPerCell,
        settings.maxVoltsPerCell,
        settings.minVoltsPerCell * settings.motorBatteryCells,
        settings.maxVoltsPerCell * settings.motorBatteryCells
    ];

    const pixhawkBatteryThreshold: Threshold = [
        settings.minVoltsPerCell,
        settings.maxVoltsPerCell,
        settings.minVoltsPerCell * settings.pixhawkBatteryCells,
        settings.maxVoltsPerCell * settings.pixhawkBatteryCells
    ];

    const ESCtemperatureThreshold: Threshold = [
        settings.minESCTemperature_c,
        settings.maxESCTemperature_c,
        CELSIUS_TO_FAHRENHEIT(settings.minESCTemperature_c),
        CELSIUS_TO_FAHRENHEIT(settings.maxESCTemperature_c)
    ];

    const [airspeed, setAirspeed] =
        useState<Parameter>(new Parameter('Airspeed', [0,0], ['m/s', 'knots'], airspeedThreshold, 0));
    const [groundspeed, setGroundspeed] =
        useState<Parameter>(new Parameter('Groundspeed', [0,0], ['m/s', 'knots'], groundspeedThreshold, 0));
    const [altitudeMSL, setAltitudeMSL] =
        useState<Parameter>(new Parameter('Altitude MSL',[0,0], ['feet', 'meters'], altitudeMSLThreshold, 0));
    const [altitudeAGL, setAltitudeAGL] =
        useState<Parameter>(new Parameter('Altitude AGL', [0,0], ['feet', 'meters'], altitudeAGLThreshold, 0));
    const [motorBattery, setMotorBattery] =
        useState<Parameter>(new Parameter('Motor Battery', [0,0], ['V/c', 'V'], motorBatteryThreshold, 0));
    const [pixhawkBattery, setPixhawkBattery] =
        useState<Parameter>(new Parameter('Pixhawk Battery', [0,0], ['V/c', 'V'], pixhawkBatteryThreshold, 0));
    const [ESCtemperature, setESCtemperature] =
        useState<Parameter>(new Parameter('ESC Temp', [0,0], ['°C', '°F'], ESCtemperatureThreshold, 0)); 

    const [planeLatLng, setPlaneLatLng] = useState<[number, number]>([0,0]);

    const [superSecret, setSuperSecret] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => pullTelemetry(
            settings,
            setPlaneLatLng,
            setAirspeed,
            setGroundspeed,
            setAltitudeMSL,
            setAltitudeAGL,
            setMotorBattery,
            setPixhawkBattery,
            setESCtemperature,
            setSuperSecret
        ), 1000);

        return () => {
            clearInterval(interval);
        }
    }, []);
    
    const flightMode = '';
    const flightModeColor = { backgroundColor: 'var(--warning-text)' };

    const handleClick = (setter: Dispatch<SetStateAction<Parameter>>) => {
        setter(param => param.getSwappedUnit());
    };

    return (
        <>
            <main className="controls-page">
                <div className="flight-telemetry-container">
                    {airspeed.render(() => handleClick(setAirspeed))}
                    {groundspeed.render(() => handleClick(setGroundspeed))}
                    {altitudeMSL.render(() => handleClick(setAltitudeMSL))}
                    {altitudeAGL.render(() => handleClick(setAltitudeAGL))}
                </div>
                {(superSecret) ? <SuperSecret></SuperSecret>
                        : <TuasMap className={'map'} lat={planeLatLng[0]} lng={planeLatLng[1]}/>}
                <div className="flight-telemetry-container">
                    <div style={flightModeColor} className='flight-telemetry' id='flight-mode'>
                        <h1 className='heading'>Flight Mode</h1>
                        <p className='data'>{flightMode}</p>
                    </div>
                    {motorBattery.render(() => handleClick(setMotorBattery))}
                    {pixhawkBattery.render(() => handleClick(setPixhawkBattery))}
                    {ESCtemperature.render(() => handleClick(setESCtemperature))}
                </div>
            </main>
        </>
    );
}

export default Control;