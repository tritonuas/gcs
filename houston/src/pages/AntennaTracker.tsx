import {useState, useEffect} from 'react'
import "./AntennaTracker.css"
import TuasMap from '../components/TuasMap';

/**
 * This page displays all of the relevant connection information for the Antenna Tracker.
 * It displays this with a map that shows the antenna tracker pointing towards the plane's
 * current location. It also has a terminal which displays the raw UDP frames being sent
 * over the wire. Eventually, it will take in props which provide the connection status information.
 * @returns Component representing page for the Antenna Tracker Connection Status
 */
function AntennaTracker() {
    const [terminalText, setTerminalText] = useState<Array<string>>([]);

    // For testing so text is constantly being added to the terminal
    useEffect(() => {
        const interval = setInterval(() => {
            // Update the text
            const date = new Date();
            setTerminalText(txt => [`${date.toString()}`].concat(txt)); 

            // const pre = document.querySelector(".atracker-terminal");
            // if (pre != null) {
            //     pre.scrollTop = pre?.scrollHeight;
            // }
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <main className="atracker-page">
                <TuasMap className="atracker-map" lat={51} lng={10} matchedArray={[]} unmatchedArray={[]} matchedIcons={[]} unmatchedIcons={[]}/>
                <div className="atracker-terminal">
                    {
                        terminalText.map((str, i) => <p key={i}>{str}</p>)
                    }
                </div>
            </main>
        </>
    );
}
export default AntennaTracker;
