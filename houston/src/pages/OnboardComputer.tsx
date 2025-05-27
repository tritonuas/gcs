import { useEffect, useState } from "react";
import Modal from "react-modal";

import "./OnboardComputer.css";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";
import TuasMap from "../components/TuasMap";
import { Marker } from "react-leaflet";

import PageOpenPopup from "../components/PageOpenPopup";
import { UBIQUITI_URL } from "../utilities/general";

// testing
import { ManualImage, OBCConnInfo } from "../protos/obc.pb";

/**
 * @returns Page for the Onboard computer connection status.
 */
function OnboardComputer() {
    const [showCameraForm, setShowCameraForm] = useState(false);

    const [obcStatus, setOBCStatus] = useState<OBCConnInfo>(
        JSON.parse(
            localStorage.getItem("obc_conn_status") || "{}"
        ) as OBCConnInfo
    );

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

    const [selectedLat, setSelectedLat] = useState(0);
    const [selectedLng, setSelectedLng] = useState(0);
    const [pictures, setPictures] = useState<{ original: string }[]>([]);
    const [metadatas, setMetadatas] = useState<{ lat: number; lng: number }[]>(
        []
    );

    /**
     * Update current selected location data of the map
     * @param index index of the slide
     */
    function handleSlide(index: number) {
        const metadata = metadatas.at(index);
        if (metadata !== undefined) {
            setSelectedLat(metadata.lat);
            setSelectedLng(metadata.lng);
        }
    }

    // var base64Data = "data:image/png;base64,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"

    return (
        <>
            <PageOpenPopup
                storageKey="ubiquiti-popup"
                contentLabel="Ubiquiti Login Information"
            >
                <p>
                    <b>Username:</b> ucsdauvsi
                </p>
                <p>
                    <b>Password:</b> triton
                </p>
                <p>
                    <a href={UBIQUITI_URL} target="_blank" rel="noreferrer">
                        {UBIQUITI_URL}
                    </a>
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
                            <input
                                type="number"
                                step="any"
                                min="0"
                                max="27.045771"
                                name="Gain"
                                id="gain-input"
                            />
                        </label>

                        <label>
                            GainAuto:
                            <input type="text" name="GainAuto" />
                        </label>

                        <label>
                            ExposureTime:
                            <input
                                type="number"
                                step="any"
                                min="359"
                                name="ExposureTime"
                            />
                        </label>

                        <label>
                            ExposureAuto:
                            <input type="text" name="ExposureAuto" />
                        </label>

                        <label>
                            BalanceWhiteAuto:
                            <input type="text" name="BalanceWhiteAuto" />
                        </label>

                        <label>
                            BalanceWhiteEnable:
                            <input type="checkbox" name="BalanceWhiteEnable" />
                        </label>

                        <label>
                            Gamma:
                            <input
                                type="number"
                                step="any"
                                min="0.2"
                                max="2.0"
                                name="Gamma"
                            />
                        </label>

                        <label>
                            GammaEnable:
                            <input type="checkbox" name="GammaEnable" />
                        </label>

                        <input type="submit" value="Submit" />
                    </fieldset>
                </form>
            </Modal>
            <main className="obc-page">
                <ul className="status-list">
                    <li>mavRcGood: {obcStatus.mavRcGood ? "true" : "false"}</li>
                    <li>mavRcStrength: {obcStatus.mavRcStrength}</li>
                    <li>
                        cameraGood: {obcStatus.cameraGood ? "true" : "false"}
                    </li>
                    <table>
                        <tr>
                            <th>Airdrop Idx</th>
                            <th>MS Since HB</th>
                        </tr>
                        {"droppedAirdropIdx" in obcStatus ? (
                            obcStatus.droppedAirdropIdx.map((_, i) => {
                                return (
                                    <tr key={i}>
                                        <td>
                                            {obcStatus.droppedAirdropIdx[i]}
                                        </td>
                                        <td>
                                            {obcStatus.msSinceAdHeartbeat[i]}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <></>
                        )}
                    </table>
                </ul>
                <button
                    onClick={() => {
                        fetch("/api/camera/capture")
                            .then((resp) => resp.json())
                            .then((json) => {
                                const msg = json as ManualImage;
                                setPictures((pictures) => [
                                    ...pictures,
                                    {
                                        original: `data:image/png;base64,${msg.imgB64}`,
                                    },
                                ]);
                                setMetadatas((metadatas) => [
                                    ...metadatas,
                                    { lat: msg.latDeg, lng: msg.lngDeg },
                                ]);
                            })
                            .catch((err) => alert(err));
                    }}
                >
                    Take Photo
                </button>

                <button
                    onClick={() => {
                        fetch("/api/dodropnow")
                            .then((resp) => resp.json())
                            .catch((err) => alert(err));
                    }}
                >
                    Drop airdrop
                </button>
                <div className="image-container">
                    <div className="gallery-container">
                        <ImageGallery
                            onSlide={handleSlide}
                            items={pictures}
                        ></ImageGallery>
                    </div>
                    <TuasMap
                        className={"map"}
                        lat={selectedLat}
                        lng={selectedLng}
                    >
                        <Marker position={[selectedLat, selectedLng]}></Marker>
                    </TuasMap>
                </div>
            </main>
        </>
    );
}
export default OnboardComputer;
