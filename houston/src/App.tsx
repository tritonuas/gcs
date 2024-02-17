import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from 'react'

import Connection from "./pages/Connection";
import AntennaTracker from "./pages/AntennaTracker";
import OnboardComputer from "./pages/OnboardComputer";
import RadioMavlink from "./pages/RadioMavlink";
import Control from './pages/Control';
import Input from './pages/Input';
import Layout from './pages/Layout';
import Report from './pages/Report';
import NoPage from './pages/NoPage';
import Settings, {SettingsConfig, loadSettings} from './pages/Settings'


import { ConnectionType, ConnectionStatus } from "./utilities/temp";

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

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout statuses={statuses}/>}>
                    <Route index element={<Connection statuses={statuses}/>} />
                    <Route path="antennatracker" element={<AntennaTracker/>} />
                    <Route path="onboardcomputer" element={<OnboardComputer/>} />
                    <Route path="radiomavlink" element={<RadioMavlink/>} />
                    <Route path="control" element={<Control settings={config}/>} />
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