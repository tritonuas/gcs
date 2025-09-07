export const UBIQUITI_URL = "http://192.168.1.35";

export const INFLUX_PORT = "8086";
export const INFLUX_URI = "/orgs/83cf98a33ce1da25/data-explorer?bucket=mavlink";

import React from "react";

/**
 * Takes a URL (e.g. https://192.168.1.4:5000) and extracts out the base,
 * meaning everything before the port. (E.g. https://192.168.1.4)
 * @param url URL to modify
 * @returns The Base of the URL
 */
export function getURLBase(url: string) {
  return url.split(":").slice(0, 2).join(":");
}

/**
 * Rounds numbers to one decimal point
 * @param val number to round
 * @returns val rounded to one decimal point
 */
export function roundDecimal(val: number): number {
  return parseFloat(val.toFixed(1));
}

/**
 * Helper function to help with scenario described here
 * https://stackoverflow.com/questions/53024496/state-not-updating-when-using-react-state-hook-within-setinterval
 * @param callback callback function to run at the interval
 * @param delay interval delay in ms
 * @returns reference to the interval in case you want to clear it manually
 */
export function useInterval(callback: () => void, delay: number) {
  const intervalRef = React.useRef<number>();
  const callbackRef = React.useRef(callback);

  // Remember the latest callback:
  //
  // Without this, if you change the callback, when setInterval ticks again, it
  // will still call your old callback.
  //
  // If you add `callback` to useEffect's deps, it will work fine but the
  // interval will be reset.

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Set up the interval:

  React.useEffect(() => {
    if (typeof delay === "number") {
      intervalRef.current = window.setInterval(() => callbackRef.current(), delay);

      // Clear interval if the components is unmounted or the delay changes:
      return () => window.clearInterval(intervalRef.current);
    }
  }, [delay]);

  // Returns a ref to the interval ID in case you want to clear it manually:
  return intervalRef;
}

export const MM_TO_METERS = (millimeters: number) => millimeters / 1000;
export const METERS_PER_SECOND_TO_KNOTS = (meters: number) => meters * 1.944;
export const FEET_TO_METERS = (feet: number) => feet / 3.281;
export const METERS_TO_FEET = (meters: number) => meters * 3.281;
export const FAHRENHEIT_TO_CELSIUS = (F: number) => (5.0 / 9.0) * (F - 32);
export const CELSIUS_TO_FAHRENHEIT = (C: number) => C * (9.0 / 5.0) + 32;
