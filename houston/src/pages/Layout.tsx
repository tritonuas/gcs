import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./Layout.css";
import duck from "../assets/duck.png"
import settingsIcon from "../assets/settings.svg"
import csvIcon from "../assets/csv.svg";


import {getIconFromStatus, } from "../utilities/connection"
import {ConnectionStatus, } from "../utilities/temp"
import { Button, Typography } from "@mui/material";
import { useState } from "react";
import { useModal } from "../components/UseMyModal";
import MyModal from "../components/MyModal";

/**
 * @param props Props
 * @param props.statuses List of connection statuses for major GCS connections.
 * @returns Layout for the entire page, including the navbar and active page.
 */
function Layout({statuses}:{statuses:ConnectionStatus[]}) {
    const navigate = useNavigate();

    const checkForActive = ({isActive}:{isActive:boolean}) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
    }

    const openSettings = () => navigate("/settings"); 

    const [influxLoading, setLoading] = useState(false);
    const [dataString, setDataString] = useState('');
    const {modalVisible, openModal, closeModal} = useModal();

    const handleInflux = () => {
        setLoading(true);
        openModal()
        fetch("/api/influx")
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
                    <Button onClick={openSettings}> 
                        <img 
                            src={settingsIcon} 
                            alt="settings" 
                            className="svg white rotate" 
                            style={{ width: "50px", height: "50px", display: "inline-block"}} 
                            />
                    </Button>
                    <Button onClick={handleInflux} disabled={influxLoading}> 
                            {
                                influxLoading ?
                                <img src={csvIcon} alt="csv" style={{ width: "50px", height: "50px"}} className="nonHoverPulse svg active"/>:
                                <img src={csvIcon} alt="csv" style={{ width: "50px", height: "50px"}} className="pulse svg white"/>
                            }
                    </Button>
                    <MyModal modalVisible={modalVisible} closeModal={closeModal} type="error" disable={influxLoading}>
                       <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                            {influxLoading ? null : dataString}
                        </Typography> 
                    </MyModal>
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