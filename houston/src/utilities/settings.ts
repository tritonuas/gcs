export const LOCAL_STORAGE_KEY = "houston-config";

export interface SettingsConfig {
  pixhawkBatteryCells: number;
  motorBatteryCells: number;

  minAirspeed_m_s: number;
  maxAirspeed_m_s: number;

  minAltitudeAGL_feet: number;
  maxAltitudeAGL_feet: number;

  groundAltitude_feet: number;

  //<Garbage that I wrote>
  minNumLaps: number;
  maxNumLaps: number;
  //</Garbage that I wrote>

  minVoltsPerCell: number;
  maxVoltsPerCell: number;

  minESCTemperature_c: number;
  maxESCTemperature_c: number;
}

/**
 * Makes a config object with all of the default values
 * @returns a default config
 */
export function makeDefaultConfig(): SettingsConfig {
  const config = {
    pixhawkBatteryCells: 4,
    motorBatteryCells: 8, // might change to 12 at some point
    minAirspeed_m_s: 10,
    maxAirspeed_m_s: 30,
    minAltitudeAGL_feet: 75,
    maxAltitudeAGL_feet: 400,
    groundAltitude_feet: 0,
    minNumLaps: 0, //Garbage that I wrote
    maxNumLaps: 67, //Garbage that I wrote, replace with actual max or if different logic needed
    minVoltsPerCell: 3.6,
    maxVoltsPerCell: 4.2,
    minESCTemperature_c: 0, // todo use real values from embedded
    maxESCTemperature_c: 80,
  } as SettingsConfig;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  return config;
}

/**
 * Gets the saved settings
 * @returns settings according to what is stored in localStorage, or a default config
 */
export function loadSettings(): SettingsConfig {
  const config = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (config === null) {
    return makeDefaultConfig();
  } else {
    return JSON.parse(config) as SettingsConfig;
  }
}
