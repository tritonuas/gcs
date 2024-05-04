import { Dispatch, SetStateAction } from "react";
import type { Parameter } from "../pages/Control";
import { MM_TO_METERS, FAHRENHEIT_TO_CELSIUS, METERS_PER_SECOND_TO_KNOTS, METERS_TO_FEET, FEET_TO_METERS } from "./general";
import { SettingsConfig } from "./settings";

/**
 * Helper function to get all of the necessary telemetry information from the backend
 * @param settings Settings, for battery cell amounts
 * @param setPlaneLatLng state setter
 * @param setAirspeedVal state setter
 * @param setGroundspeedVal state setter
 * @param setAltitudeMSLVal state setter
 * @param setAltitudeAGLVal state setter
 * @param setMotorBatteryVal state setter
 * @param setPixhawkBatteryVal state setter
 * @param setESCtemperatureVal state setter
 * @param setSuperSecret state setter
 * @param setFlightMode state setter
 */
export function pullTelemetry(
    settings: SettingsConfig,
    setPlaneLatLng: Dispatch<SetStateAction<[number, number]>>,
    setAirspeedVal: Dispatch<SetStateAction<Parameter>>,
    setGroundspeedVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeMSLVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeAGLVal: Dispatch<SetStateAction<Parameter>>,
    setMotorBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setPixhawkBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setESCtemperatureVal: Dispatch<SetStateAction<Parameter>>,
    setSuperSecret: Dispatch<SetStateAction<boolean>>,
    setFlightMode: Dispatch<SetStateAction<string>>,
) {
    fetch('/api/plane/telemetry?id=74&field=groundspeed,airspeed,heading')
        .then(resp => resp.json())
        .then(json => {
            const airspeed = json['airspeed'];
            const groundspeed = json['groundspeed'];
            setAirspeedVal((param) => param.getUpdatedValue(airspeed, METERS_PER_SECOND_TO_KNOTS));
            setGroundspeedVal((param) => param.getUpdatedValue(groundspeed, METERS_PER_SECOND_TO_KNOTS));
            // todo set heading
        })
        .catch(_ => {
            setAirspeedVal((param) => param.getErrorValue());
            setGroundspeedVal((param) => param.getErrorValue());
            setSuperSecret(true);
        })
    fetch('/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt')
        .then(resp => resp.json())
        .then(json => {
            const altitude = METERS_TO_FEET(MM_TO_METERS(json["alt"]));
            const relative_altitude = METERS_TO_FEET(MM_TO_METERS(json["relative_alt"]));
            const lat = parseFloat(json["lat"]) / 10e6;
            const lng = parseFloat(json["lon"]) / 10e6;
            setPlaneLatLng([lat, lng]);
            setAltitudeMSLVal(param => param.getUpdatedValue(altitude, FEET_TO_METERS));
            setAltitudeAGLVal(param => param.getUpdatedValue(relative_altitude, FEET_TO_METERS));
        })
        .catch(_ => {
            setAltitudeMSLVal(param => param.getErrorValue());
            setAltitudeAGLVal(param => param.getErrorValue());
            // todo figure out good error value for latlng so the map doesn't flicker to africa
        })
    fetch('/api/plane/telemetry?id=251&field=value')
        .then(resp => resp.json())
        .then(json => {
            const esc_temp = json["value"];
            setESCtemperatureVal(param => param.getUpdatedValue(esc_temp, FAHRENHEIT_TO_CELSIUS));
        })
        .catch(_ => {
            setESCtemperatureVal(param => param.getErrorValue());
        })
    fetch('/api/plane/telemetry?id=0')
        .then(resp => resp.json())
        .then(json => {
            // some respectable individual can come in later on and refactor this into
            // its own function if they so desire...
            // reference: https://mavlink.io/en/messages/common.html#MAV_MODE_FLAG
            const SAFETY_ARMED: number = 128;
            const MANUAL_INPUT_ENABLED: number = 64;
            const HIL_ENABLED: number = 32;
            const STABILIZE_ENABLED: number = 16;
            const GUIDED_ENABLED: number = 8;
            const AUTO_ENABLED: number = 4;
            // MAV_MODE_FLAG_TEST_ENABLED = 2
            // MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1

            const base_mode = Number(json["base_mode"])
            if ((base_mode & SAFETY_ARMED) != SAFETY_ARMED) {
                setFlightMode("Unarmed");
            } else {
                // we know the system is armed

                // i dont really know how all of these options combine together.
                // i.e. is stablize / HIL also on while we are in auto?
                // so i have ordered them from in an order I feel makes sense, reporting
                // the most important bits first (manual, auto) then the other ones
                // im less sure about how they will be set exactly
                if ((base_mode & MANUAL_INPUT_ENABLED) == MANUAL_INPUT_ENABLED) {
                    setFlightMode("Manual");
                } else if ((base_mode & AUTO_ENABLED) == AUTO_ENABLED) {
                    setFlightMode("Auto");
                } else if ((base_mode & STABILIZE_ENABLED) == STABILIZE_ENABLED) {
                    setFlightMode("Stablize");
                } else if ((base_mode & HIL_ENABLED) == HIL_ENABLED) {
                    setFlightMode("HIL");
                } else if ((base_mode & GUIDED_ENABLED) == GUIDED_ENABLED) {
                    setFlightMode("Guided"); // i think this will always be on if we are in auto?
                } else {
                    setFlightMode("Armed"); // idk if this ever actually happens
                }
            }
        })
    fetch('/api/plane/voltage')
        .then(resp => resp.json())
        .then(json => {
            const pixhawkV = json["0"]/1000; //kV -> V
            const motorV = json["1"]/1000;

            const PIXHAWK_CELLS = settings.pixhawkBatteryCells;
            const MOTOR_CELLS = settings.motorBatteryCells;
            setPixhawkBatteryVal(param => param.getUpdatedValue(pixhawkV / PIXHAWK_CELLS, (x) => x * PIXHAWK_CELLS));
            setMotorBatteryVal(param => param.getUpdatedValue(motorV / PIXHAWK_CELLS, (x) => x * MOTOR_CELLS));
        })
        .catch(_ => {
            setPixhawkBatteryVal(param => param.getErrorValue());
            setMotorBatteryVal(param => param.getErrorValue());
        });
}