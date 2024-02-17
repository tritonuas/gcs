import { ChangeEvent, SetStateAction } from "react"
import "./Settings.css"
import { Fragment } from "react";

const LOCAL_STORAGE_KEY = "houston-config";

export interface SettingsConfig {
    pixhawkBatteryCells: number
    motorBatteryCells: number

    minAirspeed_m_s: number
    maxAirspeed_m_s: number

    minAltitudeAGL_feet: number
    maxAltitudeAGL_feet: number

    groundAltitude_feet: number

    minVoltsPerCell: number
    maxVoltsPerCell: number

    minESCTemperature_c: number
    maxESCTemperature_c: number
}

function makeDefaultConfig(): SettingsConfig {
    const config = {
        pixhawkBatteryCells: 4,
        motorBatteryCells: 8, // might change to 12 at some point
        minAirspeed_m_s: 10,
        maxAirspeed_m_s: 30,
        minAltitudeAGL_feet: 75,
        maxAltitudeAGL_feet: 400,
        groundAltitude_feet: 0,
        minVoltsPerCell: 3.6,
        maxVoltsPerCell: 4.2,
        minESCTemperature_c: 70, // todo use real values from embedded
        maxESCTemperature_c: 80,
    } as SettingsConfig;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    return config;
}

export function loadSettings(): SettingsConfig {
    let config = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (config === null) {
        return makeDefaultConfig();
    } else {
        return JSON.parse(config) as SettingsConfig;
    }
}

export function Settings(
    {settings, setSettings}:
    {settings: SettingsConfig, setSettings: React.Dispatch<SetStateAction<SettingsConfig>>}
) {
    
    const updateSettings = (field: keyof SettingsConfig, event: ChangeEvent<HTMLInputElement>) => {
        settings[field] = event.target.value as unknown as number;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        setSettings(settings);
    };

    const resetConfig = () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(makeDefaultConfig()));
        setSettings(loadSettings());
    };

    return (
        <>
            <main className="settings-page">
                <form>
                    <legend>Settings</legend>

                    {Object.keys(settings).map(
                        (field, i) =>
                            <Fragment key={i + settings[field as keyof SettingsConfig]}>
                                <label>
                                    {field}
                                    <input
                                        onChange={(e) => updateSettings(field as keyof SettingsConfig, e)}
                                        defaultValue={settings[field as keyof SettingsConfig]}
                                        type="number"
                                        />
                                </label>
                            </Fragment>
                    )}

                    <input type="button" value="Reset to Default" onClick={resetConfig}/>
                </form>
            </main>
        </>
    );
}

export default Settings;