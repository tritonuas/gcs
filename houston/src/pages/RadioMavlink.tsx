import "./RadioMavlink.css";

import { INFLUX_PORT, INFLUX_URI, getURLBase } from "../utilities/general";
import PageOpenPopup from "../components/PageOpenPopup";

/**
 * Page where we can analyze the connection directly to the pixhawk over radio.
 * Essentially just an iframe to the influxdb database.
 * @returns Page for the radio mavlink connection status.
 */
function RadioMavlink() {
  return (
    <>
      <PageOpenPopup storageKey="mavlink-popup" contentLabel="Mavlink Login Information">
        <p>
          <b>Username:</b> tritons
        </p>
        <p>
          <b>Password:</b> tritonuas
        </p>
      </PageOpenPopup>
      <main className="radiomavlink-page">
        <iframe src={`${getURLBase(location.href)}:${INFLUX_PORT}${INFLUX_URI}`}></iframe>
      </main>
    </>
  );
}
export default RadioMavlink;
