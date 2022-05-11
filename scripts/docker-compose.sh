#!/bin/bash



function up {
    echo "Starting development docker images"
    sudo docker run -d \
        -e INTEROP_IP=172.17.0.1 \
        -e INTEROP_PORT=8000 \
        -e INTEROP_USER=ucsdauvsi \
        -e INTEROP_PASS=tritons \
        -e MAV_DEVICE=tcp:127.0.0.1:5760 \
        -e MAV_OUTPUT1=udp:127.0.0.1:14553 \
        -e MAV_OUTPUT2=udp:192.168.1.2:14551 \
        -e MAV_OUTPUT3=udp:192.168.1.3:14551 \
        -e MAV_OUTPUT4="" \
        -e MAV_OUTPUT5="" \
        -e INFLUXDB_BUCKET=mavlink \
        -e INFLUXDB_ORG=TritonUAS \
        -e INFLUXDB_TOKEN=influxdbToken \
        -e INFLUXDB_URI=http://127.0.0.1:8086 \
        -e HUB_PATH=/go/src/github.com/tritonuas/hub \
        -v missions:/go/src/github.com/tritonuas/hub/missions \
        --network host \
        tritonuas/hub
    
    sudo docker run -d \
        -v influxdb_data:/var/lib/influxdb \
        --network host \
        influxdb:2.0-alpine

    # sudo docker run -d \
    #     -e GF_USERS_DEFAULT_THEME=dark \
    #     -e GF_USERS_HOME_PAGE=/dashboards \
    #     -e GF_INSTALL_PLUGINS=briangann-gauge-panel \
    #     -e GF_DASHBOARDS_MIN_REFRESH_INTERVAL=500ms \
    #     -e GF_AUTH_DISABLE_LOGIN_FORM=true \
    #     -e GF_AUTH_ANONYMOUS_ENABLED=true \
    #     -e GF_AUTH_ANONYMOUS_ORG_NAME="Main Org." \
    #     -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin \
    #     -e GF_USERS_ALLOW_SIGN_UP=false \
    #     -v grafana_data:/var/lib/grafana \
    #     --network host \
    #     grafana/grafana:7.5.5
    #     # -v ./grafana/dashboard.yaml:/etc/grafana/provisioning/dashboards/dashboard.yaml \
    #     # -v "./grafana/datasource.yaml:/etc/grafana/provisioning/datasources/datasource.yaml" \
    #     # -v ./grafana/dashboards/:/var/lib/grafana/dashboards/ \

    sudo docker run -d \
        -e "SITL_HOME=38.145844,-76.42638,8,0" \
        -e SITL_SPEEDUP=1 \
        -v sitl:/app/logs \
        --network host \
        tritonuas/plane.rascal

    sudo docker run \
        --entrypoint "influx" \
        --restart=on-failure:20 -d \
        --network host \
        influxdb:2.0-alpine \
        setup --bucket mavlink --org TritonUAS --token influxdbToken --username tritons --password tritonuas --host http://127.0.0.1:8086 --force
    
    
    sudo docker run -d \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -p 9999:8080 \
      amir20/dozzle:latest

}

function down {
    echo "Stopping development docker images"
    docker stop $(docker container ls -q)
}

if [ "$1" == "up" ] 
then 
	up
elif [ "$1" == "down" ]
then
	down
else
	echo "Must provide up or down"
fi
