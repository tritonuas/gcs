import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from 'react'

import Connection from "./pages/Connection";
import AntennaTracker from "./pages/AntennaTracker";
import OnboardComputer from "./pages/OnboardComputer";
import RadioMavlink from "./pages/RadioMavlink";
import Control from './pages/Control';
import Input from './pages/Input';
import Layout from './pages/Layout';
import Report from './pages/Report';
import NoPage from './pages/NoPage';
import Settings from './pages/Settings'


import { ConnectionType, ConnectionStatus } from "./utilities/temp";
import { SettingsConfig, loadSettings } from "./utilities/settings";
import { LatLng } from "leaflet";

/**
 * Main React function
 * @returns App
 */
function App() {
    // for testing purposes
    const flipCoin = () => {
        return (Math.random() > 0.5);
    }

    const [statuses, _setStatuses] = useState<ConnectionStatus[]>([
        {name: "Antenna Tracker", isActive: flipCoin(), type: ConnectionType.Ethernet} as ConnectionStatus,
        {name: "Onboard Computer", isActive: flipCoin(), type: ConnectionType.Wifi} as ConnectionStatus,
        {name: "Radio Mavlink", isActive: flipCoin(), type: ConnectionType.Radio} as ConnectionStatus,
    ]);

    const [config, setConfig] = useState<SettingsConfig>(loadSettings());
    const [planeLatLng, setPlaneLatLng] = useState<[number, number]>([0,0]);
    const [coordinate, setCoordinate] = useState<LatLng[]>([]);

    useEffect(() => {
        const interval = setInterval(() => 
            fetch('/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt')
            .then(resp => resp.json())
            .then(json => {
                const lat = parseFloat(json["lat"]) / 10e6;
                const lng = parseFloat(json["lon"]) / 10e6;
                setPlaneLatLng([lat, lng]);
            }), 1000);

        return () => {
            clearInterval(interval);
        }
    }, []);

    useEffect(() => {
        if(!(planeLatLng[0] == 0 && planeLatLng[1] == 0)){
            setCoordinate(coordinate => [...coordinate, new LatLng(planeLatLng[0], planeLatLng[1])]);
        }
    }, [planeLatLng]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout statuses={statuses}/>}>
                    <Route index element={<Connection statuses={statuses}/>} />
                    <Route path="antennatracker" element={<AntennaTracker/>} />
                    <Route path="onboardcomputer" element={<OnboardComputer/>} />
                    <Route path="radiomavlink" element={<RadioMavlink/>} />
                    <Route path="control" element={<Control settings={config} planeCoordinates={coordinate}/>} />
                    <Route path="input" element={<Input />} />
                    <Route path="report" element={<Report />} />
                    <Route path="settings" element={<Settings settings={config} setSettings={setConfig}/>} />

                    <Route path="*" element={<NoPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App