import './RadioMavlink.css';

function RadioMavlink() {
    let urlBase = location.href.split(':').slice(0,2).join(':');
    // Will look something like http://localhost or http://192.168.1.5
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