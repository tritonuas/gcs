import { Outlet, NavLink } from "react-router-dom";
import "./Layout.css";
import csvRunning from "../assets/csv-running.svg";
import csvReady from "../assets/csv-ready.svg";

import duck from '../assets/duck.png';

import {getIconFromStatus, } from "../utilities/connection"
import {ConnectionStatus, } from "../utilities/temp"
import { Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import MyModal from "../components/MyModal";
import { useModal } from "../components/UseMyModal";
import PlanePicker from "../components/PlanePicker";

/**
 * @param props Props
 * @param props.statuses List of connection statuses for major GCS connections.
 * @returns Layout for the entire page, including the navbar and active page.
 */
function Layout({statuses}:{statuses:ConnectionStatus[]}) {

    const influxURL = "/api/influx";
    const [influxLoading, setLoading] = useState(false);
    const [influxReturnValue, setInfluxReturnValue] = useState('');
    const {modalVisible, openModal, closeModal} = useModal();
    const {modalVisible: planePickerModalVisible, openModal: planePickerOpenModal, closeModal: planePickerCloseModal} = useModal();
    const handlePlanePickerModal = () => {
        planePickerModalVisible ? planePickerCloseModal() : planePickerOpenModal();
    }
    const [icon, setIcon] = useState(localStorage.getItem("icon") || duck);

    const checkForActive = ({isActive}:{isActive:boolean}) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
    }

    const handleInflux = () => {
        setLoading(true);
        openModal();
        fetch(influxURL)
        .then(response => response.json())
        .then(data => {
            setInfluxReturnValue(JSON.stringify(data));
        })
        .catch(error => {
            console.error("Fetch error:", error);
        })
        .finally(() => {
            const timeoutId = setTimeout(() => {setLoading(false);}, 700);
            return () => clearTimeout(timeoutId);
        });
    }

    useEffect(() => {
        const data = localStorage.getItem("icon");
        data ? setIcon(data) : setIcon(duck);
    }, [localStorage.getItem("icon")]);

    return (
        <>
            <nav className="topbar">
                <ul>
                    <img src={icon} alt={""} onClick={handlePlanePickerModal} width={"65px"} height={"50px"} style={{ cursor: 'pointer' }}/>
                    <PlanePicker modalVisible={planePickerModalVisible} closeModal={planePickerCloseModal}></PlanePicker>
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
                    <MyModal modalVisible={modalVisible} closeModal={closeModal} loading={influxLoading}>
                       <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                            {influxLoading ? null : influxReturnValue}
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