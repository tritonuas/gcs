import "./Connection.css"
import {statusToLink} from "../utilities/connection"

import { ConnectionStatus } from "../utilities/temp";
import { OBCConnInfo } from "../protos/obc.pb";

// TODO: allow clicking on each connection status item
// in order to see a more in depth description of that
// connectiontrue


// TODO: Pull connection info from gcs, use DotPulse waiting icon before 
// data has been pulled

/**
 * Page that shows the high level connection statuses of all the components of our system
 * the GCS communicates with.
 * @param props Props
 * @param props.statuses List of connection statuses that we are tracking.
 * @returns Connection Page
 */
function Connection({statuses}:{statuses:ConnectionStatus[]}) {
    return (
        <>
            <main className="connection-page">
                <ul>
                    {statuses.map(statusToLink)} 
                </ul>
            </main>
        </>
    );
}

export default Connection;