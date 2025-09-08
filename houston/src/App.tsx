import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";

import Connection from "./pages/Connection";
import AntennaTracker from "./pages/AntennaTracker";
import OnboardComputer from "./pages/OnboardComputer";
import RadioMavlink from "./pages/RadioMavlink";
import Control from "./pages/Control";
import Input from "./pages/Input";
import Layout from "./pages/Layout";
import Report from "./pages/Report";
import NoPage from "./pages/NoPage";
import Settings from "./pages/Settings";

import { ConnectionType, ConnectionStatus } from "./utilities/temp";
import { SettingsConfig, loadSettings } from "./utilities/settings";
import { LatLng } from "leaflet";
import Drop from "./pages/Drop";

/**
 * Main React function
 * @returns App
 */
function App() {
  const [statuses, setStatuses] = useState<ConnectionStatus[]>([
    {
      name: "Antenna Tracker",
      isActive: false,
      type: ConnectionType.Ethernet,
    } as ConnectionStatus,
    {
      name: "Onboard Computer",
      isActive: false,
      type: ConnectionType.Wifi,
    } as ConnectionStatus,
    {
      name: "Radio Mavlink",
      isActive: false,
      type: ConnectionType.Radio,
    } as ConnectionStatus,
  ]);

  const [config, setConfig] = useState<SettingsConfig>(loadSettings());
  const [planeLatLng, setPlaneLatLng] = useState<[number, number]>([0, 0]);
  const [coordinate, setCoordinate] = useState<LatLng[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt")
        .then((resp) => resp.json())
        .then((json) => {
          const lat = parseFloat(json["lat"]) / 10e6;
          const lng = parseFloat(json["lon"]) / 10e6;
          setPlaneLatLng([lat, lng]);
        });
    }, 500);

    const interval_long = setInterval(() => {
      // I hate this but don't feel motivated to refactor it, sorry ~Tyler 4/13/24
      fetch("/api/connections")
        .then((resp) => resp.json())
        .then((json) => {
          setStatuses((old) =>
            old.map((status: ConnectionStatus) => {
              switch (status.name) {
                case "Antenna Tracker":
                  return {
                    isActive: json["antenna_tracker"],
                    type: status.type,
                    name: status.name,
                  } as ConnectionStatus;
                case "Onboard Computer":
                  return {
                    isActive: json["plane_obc"],
                    type: status.type,
                    name: status.name,
                  } as ConnectionStatus;
                case "Radio Mavlink":
                  return {
                    isActive: json["radio_mavlink"],
                    type: status.type,
                    name: status.name,
                  } as ConnectionStatus;
                default:
                  return {} as ConnectionStatus;
              }
            }),
          );
        });
      fetch("/api/obc_connection")
        .then((resp) => resp.json())
        .then((json) => {
          // these keys are defined in the /connections route of the backend
          localStorage.setItem("obc_conn_status", JSON.stringify(json));
        });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(interval_long);
    };
  }, []);

  useEffect(() => {
    if (!(planeLatLng[0] == 0 && planeLatLng[1] == 0)) {
      setCoordinate((coordinate) => [...coordinate, new LatLng(planeLatLng[0], planeLatLng[1])]);
    }
  }, [planeLatLng]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout statuses={statuses} />}>
          <Route index element={<Connection statuses={statuses} />} />
          <Route path="antennatracker" element={<AntennaTracker planeLatLng={planeLatLng} />} />
          <Route path="onboardcomputer" element={<OnboardComputer />} />
          <Route path="radiomavlink" element={<RadioMavlink />} />
          <Route
            path="control"
            element={<Control settings={config} planeCoordinates={coordinate} />}
          />
          <Route path="input" element={<Input />} />
          <Route path="report" element={<Report />} />
          <Route path="settings" element={<Settings settings={config} setSettings={setConfig} />} />
          <Route path="drop" element={<Drop />} />

          <Route path="*" element={<NoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
