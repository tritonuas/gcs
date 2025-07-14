import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./Layout.css";

import { getIconFromStatus } from "../utilities/connection";
import { ConnectionStatus } from "../utilities/temp";
import { Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useMyModal } from "../components/UseMyModal";
import { OBCConnInfo } from "../protos/obc.pb";
import MyModal from "../components/MyModal";
import PlanePicker from "../components/PlanePicker";
import AirdropConnectionStatus from "../components/AirdropConnectionStatus";

import csv from "../assets/csv.svg";
import duck from "../assets/duck.png";
import settingsIcon from "../assets/settings.svg";
import sprite from "../assets/sprite.png";
import fanta from "../assets/fanta.png";
import coca from "../assets/coca.png";

/**
 * @param props Props
 * @param props.statuses List of connection statuses for major GCS connections.
 * @returns Layout for the entire page, including the navbar and active page.
 */
function Layout({ statuses }: { statuses: ConnectionStatus[] }) {
    const navigate = useNavigate();
    const openSettings = () => navigate("/settings");
    const [influxLoading, setLoading] = useState(false);
    const [influxReturnValue, setInfluxReturnValue] = useState("");
    const { modalVisible, openModal, closeModal } = useMyModal();
    const {
        modalVisible: planePickerModalVisible,
        openModal: planePickerOpenModal,
        closeModal: planePickerCloseModal,
    } = useMyModal();
    const {
        modalVisible: bcsModalVisible,
        openModal: bcsOpenModal,
        closeModal: bcsCloseModal,
    } = useMyModal();
    const [icon, setIcon] = useState(localStorage.getItem("icon") || duck);
    const [obcStatus, setOBCStatus] = useState<OBCConnInfo>(
        JSON.parse(
            localStorage.getItem("obc_conn_status") || "{}"
        ) as OBCConnInfo
    );
    const [airdropIcon, setAirdropIcon] = useState(sprite);
    const checkForActive = ({ isActive }: { isActive: boolean }) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
    };

    const handleStorageChange = () => {
        const data = localStorage.getItem("icon");
        data ? setIcon(data) : setIcon(duck);
    };

    const handlePlanePickerModal = () => {
        planePickerModalVisible
            ? planePickerCloseModal()
            : planePickerOpenModal();
    };

    const handleAirdropConnectionStatusModal = () => {
        bcsModalVisible ? bcsCloseModal() : bcsOpenModal();
    };

    const handleInflux = () => {
        setLoading(true);
        openModal();
        fetch("/api/influx")
            .then((response) => response.json())
            .then((data) => {
                setInfluxReturnValue(JSON.stringify(data));
            })
            .catch((error) => alert(error))
            .finally(() => {
                const timeoutId = setTimeout(() => {
                    setLoading(false);
                }, 700);
                return () => clearTimeout(timeoutId);
            });
    };

    useEffect(() => {
        window.addEventListener("storage", () => {
            handleStorageChange();
        });
        window.dispatchEvent(new Event("storage"));
        return () => {
            window.removeEventListener("storage", () => {
                handleStorageChange();
            });
        };
    });

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

    useEffect(() => {
        let droppedAirdrops;
        "droppedAirdropIdx" in obcStatus
            ? (droppedAirdrops = obcStatus.droppedAirdropIdx.length)
            : (droppedAirdrops = 0);

        switch (droppedAirdrops) {
            case 1:
            case 2:
            case 3:
                setAirdropIcon(fanta);
                break;
            case 4:
                setAirdropIcon(coca);
                break;
            default:
                setAirdropIcon(sprite);
                break;
        }
    }, [obcStatus]);

    return (
        <>
            <nav className="topbar">
                <ul>
                    <img
                        src={icon}
                        alt={""}
                        onClick={handlePlanePickerModal}
                        width={"65px"}
                        height={"50px"}
                        style={{ cursor: "pointer" }}
                    />
                    <PlanePicker
                        modalVisible={planePickerModalVisible}
                        closeModal={planePickerCloseModal}
                    ></PlanePicker>
                    <li>
                        <NavLink to="/" className={checkForActive}>
                            Connection
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/control" className={checkForActive}>
                            Control
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/input" className={checkForActive}>
                            Input
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/report" className={checkForActive}>
                            Report
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/drop" className={checkForActive}>
                            Drop
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/targetmatch" className={checkForActive}>
                            Target
                        </NavLink>
                    </li>
                    <Button onClick={handleAirdropConnectionStatusModal}>
                        <img
                            src={airdropIcon}
                            alt="bottle connection status"
                            style={{
                                width: airdropIcon == fanta ? "70px" : "30px",
                                height: "50px",
                                display: "inline-block",
                            }}
                        />
                    </Button>
                    <AirdropConnectionStatus
                        modalVisible={bcsModalVisible}
                        closeModal={bcsCloseModal}
                    ></AirdropConnectionStatus>
                    <Button onClick={openSettings}>
                        <img
                            src={settingsIcon}
                            alt="settings"
                            className="svg white rotate"
                            style={{
                                width: "50px",
                                height: "50px",
                                display: "inline-block",
                            }}
                        />
                    </Button>
                    <Button onClick={handleInflux} disabled={influxLoading}>
                        <img
                            src={csv}
                            alt="csv"
                            style={{ width: "50px", height: "50px" }}
                            className="pulse svg white"
                        />
                        :
                    </Button>
                    <MyModal
                        modalVisible={modalVisible}
                        closeModal={closeModal}
                        loading={influxLoading}
                    >
                        <Typography
                            id="modal-modal-title"
                            variant="h6"
                            component="h2"
                            textAlign={"center"}
                        >
                            {influxReturnValue}
                        </Typography>
                    </MyModal>
                    {/* If another page is added, need to adjust the nth child rule in the css
                    so that the status icons are still right aligned */}
                    {statuses.map(getIconFromStatus)}
                </ul>
            </nav>
            <Outlet />
        </>
    );
}

export default Layout;
