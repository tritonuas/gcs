import { Outlet, NavLink } from "react-router-dom";
import "./Layout.css";
import duck from "../images/duck.png"

const Layout = () => {
  return (
    <>
      <nav>
        <ul>
          <img src={duck} alt={""}/>
          <li>
            <NavLink to="/" activeClassName="active">Connection</NavLink>
          </li>
          <li>
            <NavLink to="/control" activeClassName="active">Control</NavLink>
          </li>
          <li>
            <NavLink to="/input" activeClassName="active">Input</NavLink>
          </li>
          <li>
            <NavLink to="/report" activeClassName="active">Report</NavLink>
          </li>
          <li>
            <NavLink to="/camera" activeClassName="active">Camera</NavLink>
          </li>
        </ul>
      </nav>

      <Outlet />
    </>
  )
};

export default Layout;