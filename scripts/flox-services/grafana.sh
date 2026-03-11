#!/usr/bin/env bash
export GF_PATHS_DATA=$(pwd)/.flox/run/grafana/data
export GF_PATHS_LOGS=$(pwd)/.flox/run/grafana/logs
export GF_PATHS_PLUGINS=$(pwd)/.flox/run/grafana/plugins
export GF_PATHS_PROVISIONING=$(pwd)/.flox/run/grafana/provisioning

mkdir -p $GF_PATHS_DATA
mkdir -p $GF_PATHS_LOGS
mkdir -p $GF_PATHS_PLUGINS
mkdir -p $GF_PATHS_PROVISIONING

# Copy provisioning files if they exist
# Update path in dashboard.yaml and copy
sed "s|/var/lib/grafana/dashboards|$GF_PATHS_DATA/dashboards|g" deployments/grafana/dashboard.yaml > $GF_PATHS_PROVISIONING/dashboard.yaml

# Update influxdb url in datasource.yaml and copy
sed "s|http://influxdb:8086|http://localhost:8086|g" deployments/grafana/datasource.yaml > $GF_PATHS_PROVISIONING/datasource.yaml
# Also need dashboards folder
mkdir -p $GF_PATHS_DATA/dashboards
cp -r deployments/grafana/dashboards/* $GF_PATHS_DATA/dashboards/

export GF_USERS_DEFAULT_THEME=dark
export GF_USERS_HOME_PAGE=/dashboards
export GF_DASHBOARDS_MIN_REFRESH_INTERVAL=500ms
export GF_AUTH_DISABLE_LOGIN_FORM=true
export GF_AUTH_ANONYMOUS_ENABLED=true
export GF_AUTH_ANONYMOUS_ORG_NAME="Main Org."
export GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
export GF_USERS_ALLOW_SIGN_UP=false

# Find grafana home path
GRAFANA_BIN=$(which grafana-server)
GRAFANA_HOME=$(dirname $(dirname $GRAFANA_BIN))/share/grafana

echo "Starting Grafana..."
grafana-server \
  --homepath "$GRAFANA_HOME" \
  --config "" \
  cfg:default.paths.data=$GF_PATHS_DATA \
  cfg:default.paths.logs=$GF_PATHS_LOGS \
  cfg:default.paths.plugins=$GF_PATHS_PLUGINS \
  cfg:default.paths.provisioning=$GF_PATHS_PROVISIONING

EXIT_CODE=$?
echo "Grafana exited with $EXIT_CODE"
exit $EXIT_CODE
