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

export function roundDecimal(val: number, places: number): number {
    return parseFloat(val.toFixed(places));
} 