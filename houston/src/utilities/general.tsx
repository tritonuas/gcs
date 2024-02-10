export const UBIQUITI_URL = "http://192.168.1.35";

export const INFLUX_PORT = "8086";
export const INFLUX_URI = "/orgs/83cf98a33ce1da25/data-explorer?bucket=mavlink";

/**
 * Takes a URL (e.g. https://192.168.1.4:5000) and extracts out the base,
 * meaning everything before the port. (E.g. https://192.168.1.4)
 * @param url URL to modify
 * @returns The Base of the URL
 */
export function getURLBase(url: string) {
    return url.split(':').slice(0,2).join(':');
}

export function roundDecimal(val: number): number {
    return parseFloat(val.toFixed(1));
} 

export const MM_TO_METERS = (millimeters: number) => millimeters / 1000;
export const METERS_PER_SECOND_TO_KNOTS = (meters: number) => meters * 1.944;
export const FEET_TO_METERS = (feet: number) => feet / 3.281;
export const METERS_TO_FEET = (meters: number) => meters * 3.281;
export const FAHRENHEIT_TO_CELSIUS = (F: number) => (5.0/9.0) * (F-32);