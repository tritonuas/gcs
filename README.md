# Hub

[![Linting](https://github.com/tritonuas/hub/workflows/Linting/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ALinting)
[![Tests](https://github.com/tritonuas/hub/workflows/Tests/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ATests)
[![Docker](https://github.com/tritonuas/hub/workflows/Docker/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ADocker)

Hub is a back-end web-server that facilitates communication between other
modules in the TUAS system, including Computer Vision, Path Planning, and Houston (the frontend).

## Dependencies

- go 1.19
- [docker](https://docs.docker.com/engine/install/)
- [docker-compose](https://docs.docker.com/compose/install/) (needed to run hub concurrently with [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot))
- [golangci-lint](https://github.com/golangci/golangci-lint)
- [goimports](https://pkg.go.dev/golang.org/x/tools/cmd/goimports)

## First Time Setup

To install Docker, follow the instructions in the above links. 

To install Go, the easiest way is to use [g](https://github.com/stefanmaric/g). The repo's 
README contains installation instructions. Make sure to install and set up go 1.19. 

To install the linter, run the following make command. If you encounter a permission denied error, 
then rerun the command with sudo permissions.

```sh
make install-linter
```

To install the formatter, run the following make command.

```sh
make install-fmter
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
```

Run full hub workflow with multiple components (Includes [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot)
``` sh
make run-compose
```

### Stop Compose
``` sh
# Stop docker-compose workflow
make stop-compose
```

## Ports and Stuff

When running [houston2](https://github.com/tritonuas/houston2), you will need to enter the IP of Hub. This can be found by running the following
command when you are running Hub as a docker container.

```sh
# find IP of hub
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container_name_or_id
```

If you are running Hub locally on your machine, then the IP is just `localhost` or `127.0.0.1`

## Test

```sh
make test
```

## Lint

```sh
make lint
```

If you want to disable the linter for a specific line then add `//nolint: lint_type`.
```go
data, _ := fetchData() //nolint: errcheck
```

## Format

```sh
make fmt
```
