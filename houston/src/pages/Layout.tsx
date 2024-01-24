import { Outlet, NavLink } from "react-router-dom";
import "./Layout.css";
import duck from "../assets/duck.png"
import csvRunning from "../assets/csv-running.svg";
import csvReady from "../assets/csv-ready.svg";
import exit from "../assets/close.svg";

import {getIconFromStatus, } from "../utilities/connection"
import {ConnectionStatus, } from "../utilities/temp"
import { Box, Button, Modal, Typography } from "@mui/material";
import { useState } from "react";


/**
 * @param props Props
 * @param props.statuses List of connection statuses for major GCS connections.
 * @returns Layout for the entire page, including the navbar and active page.
 */
function Layout({statuses}:{statuses:ConnectionStatus[]}) {

    const checkForActive = ({isActive}:{isActive:boolean}) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
    }

    const influxURL = "http://localhost:5000/api/influx";

    const [influxLoading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataString, setDataString] = useState('');

    const handleInflux = () => {
        setLoading(true);
        setModalVisible(true);
        fetch(influxURL)
        .then(response => response.json())
        .then(data => {
            setDataString(JSON.stringify(data));
        })
        .catch(error => alert(error))
        .finally(() => {
            const timeoutId = setTimeout(() => {setLoading(false);}, 700);
            return () => clearTimeout(timeoutId);
        });
    }

    const closeModal = () => {
        setModalVisible(false);
    };

    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: '#2C6CFB',
        border: '2px solid #000',
        borderRadius: "7px",
        boxShadow: 24,
        p: 2,
        justifyContent: "space-between",
    };

    return (
        <>
            <nav className="topbar">
                <ul>
                    <img src={duck} alt={""}/>
                    <li>
                        <NavLink to="/" className={checkForActive}>Connection</NavLink>
                    </li>
                    <li>
                        <NavLink to="/control" className={checkForActive}>Control</NavLink>
                    </li>
                    <li>
                        <NavLink to="/input" className={checkForActive}>Input</NavLink>
                    </li>
                    <li>
                        <NavLink to="/report" className={checkForActive}>Report</NavLink>
                    </li>
                    <Button onClick={handleInflux} disabled={influxLoading}> 
                            {
                                influxLoading ?
                                <img src={csvRunning} alt="csv icon" style={{ width: "50px", height: "50px"}} className="nonHoverPulse"/>:
                                <img src={csvReady} alt="csv icon" style={{ width: "50px", height: "50px"}} className="pulse"/>
                            }
                    </Button>
                    <Modal open={modalVisible} onClose={closeModal} aria-labelledby="modal-modal-title" aria-describedby="modal-modal-description">
                        <Box sx={style}>
                            <Button onClick={closeModal}>
                                <img src={exit} />
                            </Button>
                            <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                                {influxLoading ? "Loading": dataString}
                            </Typography>
                        </Box>
                    </Modal>
                    {/* If another page is added, need to adjust the nth child rule in the css
                    so that the status icons are still right aligned */}
                    {statuses.map(getIconFromStatus)}
                </ul>
            </nav>
            <Outlet/>
        </>
    )
}

export default Layout;