import './RadioMavlink.css';

/**
 * Page where we can analyze the connection directly to the pixhawk over radio.
 * Essentially just an iframe to the influxdb database.
 * @returns Page for the radio mavlink connection status.
 */
function RadioMavlink() {
    const urlBase = location.href.split(':').slice(0,2).join(':');
    // http://localhost:5000/connection -> http://localhost
    // Or for equivalent 192.168.1.x address.
    // We can then append on the correct influxdb port and URI 

    return (
        <>
            <main className="radiomavlink-page">
                <iframe src={`${urlBase}:8086/orgs/83cf98a33ce1da25/data-explorer?bucket=mavlink`}>
                </iframe>
            </main>
        </>
    );
}
export default RadioMavlink;