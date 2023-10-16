import {FC} from "react"
import { Outlet, NavLink } from "react-router-dom";
import "./Layout.css";
import duck from "../assets/duck.png"



const Layout: FC = () => {

    const checkForActive = ({isActive}:{isActive:boolean}) => {
        if (isActive) {
            return "active";
        } else {
            return "inactive";
        }
    }
    
    return (
        <>
            <nav>
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
                </ul>
            </nav>
            <Outlet/>
        </>
    )
};

export default Layout;