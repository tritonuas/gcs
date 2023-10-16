import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Connection from "./pages/Connection";
import Camera from './pages/Camera';
import Control from './pages/Control';
import Input from './pages/Input';
import Layout from './pages/Layout';
import Report from './pages/Report';
import NoPage from './pages/NoPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Connection />} />
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