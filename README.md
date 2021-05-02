# Hub

[![Linting](https://github.com/tritonuas/hub/workflows/Linting/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ALinting)
[![Tests](https://github.com/tritonuas/hub/workflows/Tests/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ATests)
[![Docker](https://github.com/tritonuas/hub/workflows/Docker/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ADocker)



Hub is a backend webserver that faciliates communication between many
other modules in the TUAS system, including
[Houston](https://github.com/tritonuas/houston),
[OBC](https://github.com/tritonuas/planeobc), and more. It
also communicates with the [Interop Judging
Server](https://github.com/auvsi-suas/interop) to grab the mission
plans and submit waypoints.
As of now, it does NOT deal with computer vision stuff; for that, see
[matts-new-glasses](https://github.com/tritonuas/matts-new-glasses).

The hub is currently hosted on
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

## Usage

### Local

```sh
# build hub
make build
# run hub with testuser
make run
```

### Docker

```sh
# docker build
make build-docker
# run
make run-docker
```

### Docker-Compose
```sh
# docker build
make build-docker
# run docker-compose
make run-compose
```

## Ports and Stuff

Check [houston](https://github.com/tritonuas/houston) for usage instructions

In houston, the `Backend Addr` always needs to match that of hub

```sh
# find ip of hub
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container_name_or_id
```

## Test

```
make test
```
