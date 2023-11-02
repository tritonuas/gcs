import { Outlet, NavLink } from "react-router-dom";
import "./Layout.css";
import duck from "../assets/duck.png"

import {getIconFromStatus, ConnectionStatus} from "./Connection" // TODO modify to protobufs


/**
 * 
 * @param param0 
 * @returns 
 */
function Layout({statuses}:{statuses:ConnectionStatus[]}) {

    const checkForActive = ({isActive}:{isActive:boolean}) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
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
                    <li>
                        <NavLink to="/camera" className={checkForActive}>Camera</NavLink>
                    </li>
                    {/* If another page is added, need to adjust the nth child rule in the css
                    so that the status icons are still right aligned */}
                    {statuses.map(getIconFromStatus)}
                </ul>
            </nav>
            <Outlet/>
        </>
    )
};

export default Layout;