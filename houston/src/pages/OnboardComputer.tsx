import {useEffect, useState} from 'react'
import ImageGallery from 'react-image-gallery'
import Modal from 'react-modal'

import './OnboardComputer.css'
import "react-image-gallery/styles/css/image-gallery.css";

import heartbeatIcon from '../assets/heartbeat.svg'
import cameraIcon from '../assets/camera.svg'

import PageOpenPopup from '../components/PageOpenPopup';
import { UBIQUITI_URL } from '../utilities/general';

// testing
import duckPic from '../assets/duck.png';

/**
 * @returns Page for the Onboard computer connection status.
 */
function OnboardComputer() {
    const [showCameraForm, setShowCameraForm] = useState(false);

    const [obcStatus, setOBCStatus] = useState({});

    const handleStorageChange = () => {
        const data = localStorage.getItem("obc_status");
        data ? setIcon(data) : setIcon(duck);
    };

    useEffect(() => {
        window.addEventListener("storage", () => {handleStorageChange})
        window.dispatchEvent(new Event("storage"))
        return () => {window.removeEventListener("storage", () => {handleStorageChange})}
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
                <div className="left-container">
                    <ImageGallery items={images}/>
                </div>
                <ul className="status-list">
                    <li>
                        <figure>
                            <img src={cameraIcon} 
                                id="camera-icon"
                                className={(obcConn.cameraConnected ? "svg active" : "svg inactive")}
                                onClick={() => {
                                    setShowCameraForm(true);
                                }}/>
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
            </main>
        </>
    );
}
export default OnboardComputer;