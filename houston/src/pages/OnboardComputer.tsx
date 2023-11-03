import {useState} from 'react'
import ImageGallery from 'react-image-gallery'

import './OnboardComputer.css'
import "react-image-gallery/styles/css/image-gallery.css";

import heartbeatIcon from '../assets/heartbeat.svg'
import cameraIcon from '../assets/camera.svg'

import { PageOpenPopup } from '../utilities/PageOpenPopup';
import { UBIQUITI_URL } from '../utilities/general';

// testing
import duckPic from '../assets/duck.png'

// TODO: move to protobuf
interface OBCConnection {
    cameraConnected: boolean,
    images: string[], // URLs
    mavHeartbeat: number | null
}

/**
 * @returns Page for the Onboard computer connection status.
 */
function OnboardComputer() {
    // TODO: eventuallly replace to prop that is passed through...
    const [obcConn, _setOBCConn] = useState<OBCConnection>({
        cameraConnected: false,
        images: [],
        mavHeartbeat: .5112312312,
    });

    // TODO: testing... eventually load these from the fetch requests from backend
    const images = [
        {
            original: duckPic,
        },
        {
            original: duckPic,
        },
        {
            original: duckPic,
        }
    ]

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
            </PageOpenPopup>
            <main className="obc-page">
                <div className="left-container">
                    <ImageGallery items={images}/>
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
                    <ul className="status-list">
                        <li>
                            <figure>
                                <img src={cameraIcon} 
                                    className={(obcConn.cameraConnected ? "svg active" : "svg inactive")}/>
                            </figure>
                        </li>
                        <li>
                            <figure>
                                <img src={heartbeatIcon}
                                    className={(obcConn.mavHeartbeat != null) ? "svg active" : "svg inactive"}/>
                                <figcaption>{obcConn.mavHeartbeat?.toFixed(4)}</figcaption>
                            </figure>
                        </li>
                    </ul>
                </div>
                <iframe className="ubiquiti" src={`${UBIQUITI_URL}`}>
                </iframe>
            </main>
        </>
    );
}
export default OnboardComputer;