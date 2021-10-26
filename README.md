# Hub

[![Linting](https://github.com/tritonuas/hub/workflows/Linting/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ALinting)
[![Tests](https://github.com/tritonuas/hub/workflows/Tests/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ATests)
[![Docker](https://github.com/tritonuas/hub/workflows/Docker/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ADocker)

Hub is a back-end web-server that facilitates communication between other
modules in the TUAS system, including
[Houston](https://github.com/tritonuas/houston),
[OBC](https://github.com/tritonuas/planeobc),
and more. It also communicates with the
[Interop Judging Server](https://github.com/auvsi-suas/interop)
to grab the mission plans and submit waypoints. As of now, it does NOT deal with
computer vision stuff; for that, see
[matts-new-glasses](https://github.com/tritonuas/matts-new-glasses).

Hub is currently hosted on
[Dockerhub](https://hub.docker.com/repository/docker/tritonuas/hub).

## Dependencies

- go 1.14
- protobuf-compiler
- [docker](https://docs.docker.com/engine/install/)
- [docker-compose](https://docs.docker.com/compose/install/) (needed to run hub concurrently with [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot))

Both of these should be handled with this script

```sh
# download git submodules
make submodulesupdate
# install go and protobuf-compiler
make install-dependencies
```

## Build

``` sh
# Build local hub executable
make build

# Build Docker image
make build-docker
```

Note that running docker commands may require sudo. 

## Run

``` sh
# Run hub with testuser locally
make run

# Run docker image of hub
make run-docker

# Run full hub workflow with multiple components (Includes [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot) Will include [Interop](https://github.com/auvsi-suas/interop) in the future)
make run-compose
```

## Stop
``` sh
# Stop docker-compose workflow
make stop-compose
```

## Ports and Stuff

Check [houston](https://github.com/tritonuas/houston) for usage instructions

In houston, the `Backend Addr` always needs to match that of hub

```sh
# find IP of hub
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container_name_or_id
```

## Test

```sh
make test
```
