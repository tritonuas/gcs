# Houston

Houston is the front-end component of **gcs**. It provides the interface to control and monitor the competition mission.

## Wiki
For more implementation level details of the repo, please visit the Wiki [here](). (TODO: write wiki pages for Houston).

## Pages

### Connections Page
```
# Relevant Files

/html/connection.html
/css/connection.css
/js/connection.js
```

The connections page allows us to monitor the connection statuses of the various modules that Hub connects to. These include [TODO: insert all here]

It also will eventually allow us to update Mavlink forwarding endpoints. So, if somebody wants their laptop to receive the mavlink packets so they can run Mission Planner, they will be able to connect to the LAN and add their local IP. However, this is not currently working.

### Control Page
```
# Relevant Files

/html/mission-control.html
/css/mission-control.css
/js/mission-control.js
```

The control page provides the map and dashboard interface to monitor the plane and control its status. The competition requires that we always have the following displayed: Airspeed in knots, Groundspeed in knots, and Altitude in MSL. This page fulfills that requirement.

### Input Page
```
# Relevant Files

/html/mission-input.html
/css/mission-input.css
/js/mission-input.js
```

The Input page allows us to input information the system needs before takeoff. This includes: bottle assignments, flight zone boundaries, search zone boundaries, and competition waypoints.

### Report Page
```
# Relevant Files

/html/mission-report.html
/css/mission-report.css
/js/mission-report.js
```

The report page allows us to view the bottle assignments that CV computed. It also allows us view all detected targets and swap bottle assignments manually if we detect an error.

### Jetson Page
```
# Relevant Files

/html/jetson-debug.html
/css/jetson-debug.css
/js/jetson-debug.js
```

This page allows debugging of the camera connected to the Jetson.