import {useEffect, useState} from 'react'
import Modal from 'react-modal'

import './OnboardComputer.css'
import "react-image-gallery/styles/css/image-gallery.css";


import PageOpenPopup from '../components/PageOpenPopup';
import { UBIQUITI_URL } from '../utilities/general';

// testing
import { OBCConnInfo } from '../protos/obc.pb';

/**
 * @returns Page for the Onboard computer connection status.
 */
function OnboardComputer() {
    const [showCameraForm, setShowCameraForm] = useState(false);

    const [obcStatus, setOBCStatus] = useState<OBCConnInfo>(JSON.parse(localStorage.getItem("obc_conn_status") || "{}") as OBCConnInfo);

    /**
     * Note: the way protobuf serialization works is that if things are null values (false, 0.0) then they
     * wont show up in the serialization, as that can be "implied" to be a zero value by it not being there.
     * (At least this is my understanding). Therefore, if some of the expected values in the struct aren't there
     * it is because they are false/0.0 or some other 0-like value.
     */

    useEffect(() => {
        setInterval(() => {
            const data = localStorage.getItem("obc_conn_status") || "{}";
            setOBCStatus(JSON.parse(data));
        }, 1000);
    }, []);


    return (
        <>
            <PageOpenPopup
                storageKey='ubiquiti-popup'
                contentLabel='Ubiquiti Login Information'
            >
                <p>
                    <b>Username:</b> ucsdauvsi
                </p> 
                <p>
                    <b>Password:</b> triton
                </p>
                <p>
                    <a href={UBIQUITI_URL} target="_blank" rel="noreferrer">{UBIQUITI_URL}</a>
                </p>
            </PageOpenPopup>
            <Modal
                isOpen={showCameraForm} 
                onRequestClose={() => setShowCameraForm(false)}
                contentLabel={"Camera Config"}
                className="obc-camera-form-modal"
                >
                <form>
                    <fieldset>
                        <legend>Camera Config</legend>
                        <label> 
                            Gain:
                            <input type="number" step="any" min="0" max="27.045771" name="Gain" id="gain-input"/>
                        </label>

                        <label>
                            GainAuto:
                            <input type="text" name="GainAuto"/>
                        </label>

                        <label>
                            ExposureTime:
                            <input type="number" step="any" min="359" name="ExposureTime" />
                        </label>

                        <label>
                            ExposureAuto:
                            <input type="text" name="ExposureAuto"/>
                        </label>

                        <label>
                            BalanceWhiteAuto: 
                            <input type="text" name="BalanceWhiteAuto"/>
                        </label>

                        <label>
                            BalanceWhiteEnable: 
                            <input type="checkbox" name="BalanceWhiteEnable" />
                        </label>

                        <label>
                            Gamma: 
                            <input type="number" step="any" min="0.2" max="2.0" name="Gamma" />
                        </label>

                        <label>
                            GammaEnable: 
                            <input type="checkbox" name="GammaEnable"/>
                        </label>

                        <input type="submit" value="Submit"/>
                    </fieldset>
                </form>
            </Modal>
            <main className="obc-page">
                <ul className="status-list">
                    <li>
                        mavRcGood: {(obcStatus.mavRcGood) ? "true" : "false"}
                    </li>
                    <li>
                        mavRcStrength: {obcStatus.mavRcStrength}
                    </li>
                    <li>
                        cameraGood: {(obcStatus.cameraGood) ? "true" : "false"}
                    </li>
                    <table>
                        <tr>
                            <th>Bottle Idx</th>
                            <th>MS Since HB</th>
                        </tr>
                        {obcStatus.droppedBottleIdx.map((_, i) => {
                            return(
                                <tr key={i}>
                                    <td>
                                        {obcStatus.droppedBottleIdx[i]}
                                    </td>
                                    <td>
                                        {obcStatus.msSinceAdHeartbeat[i]}
                                    </td>
                                </tr>
                            )
                        })}
                    </table>
                </ul>
            </main>
        </>
    );
}
export default OnboardComputer;