import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from 'react'

import Connection from "./pages/Connection";
import Camera from './pages/Camera';
import Control from './pages/Control';
import Input from './pages/Input';
import Layout from './pages/Layout';
import Report from './pages/Report';
import NoPage from './pages/NoPage';

import {ConnectionType, ConnectionStatus} from "./pages/Connection" // TODO modify to protobufs

function App() {
    // for testing purposes
    let flipCoin = () => {
        return (Math.random() > 0.5);
    }

    const [statuses, setStatuses] = useState<ConnectionStatus[]>([
        {name: "Antenna Tracker", isActive: flipCoin(), type: ConnectionType.Ethernet} as ConnectionStatus,
        {name: "Onboard Computer", isActive: flipCoin(), type: ConnectionType.Wifi} as ConnectionStatus,
        {name: "Radio Mavlink", isActive: flipCoin(), type: ConnectionType.Radio} as ConnectionStatus,
    ]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout statuses={statuses}/>}>
                    <Route index element={<Connection statuses={statuses}/>} />
                    <Route path="control" element={<Control />} />
                    <Route path="input" element={<Input />} />
                    <Route path="report" element={<Report />} />
                    <Route path="camera" element={<Camera />} />
                    <Route path="*" element={<NoPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App