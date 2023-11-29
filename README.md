# gcs

[![Linting](https://github.com/tritonuas/gcs/workflows/Linting/badge.svg)](https://github.com/tritonuas/gcs/actions?query=workflow%3ALinting)
[![Tests](https://github.com/tritonuas/gcs/workflows/Tests/badge.svg)](https://github.com/tritonuas/gcs/actions?query=workflow%3ATests)
[![Docker](https://github.com/tritonuas/gcs/workflows/Docker/badge.svg)](https://github.com/tritonuas/gcs/actions?query=workflow%3ADocker)

**gcs** is TUAS's Ground Control Station. It serves as a webapp and is comprised of many smaller modules which all have their own functions. If you want to learn more about each part individually, you can click on the links below to go to its specific README. 

Entries in bold indicate that it is a module which we implement.

- **[Hub](/internal/README.md): A back-end (written in Go) that facilitates the communication between all the different components of the entire TUAS ecosystem. This includes the [OBC](), [CVS](https://github.com/tritonuas/computer-vision-server), [Antenna Tracker](https://github.com/tritonuas/antenna-tracker). It also serves as the central node between all of The Skeld's internal parts, which are listed below.**
- **[Houston](/static/README.md): A front-end (written in vanilla HTML/CSS/JavaScript). This provides the user interface to interact with Hub.**
- InfluxDB: A database to which Hub saves plane telemetry data.
- Grafana: A third-party front-end interface we use to display dashboards for data stored in InfluxDB. While Houston does include a dashboard for the most important information, Grafana is much more flexible to view any arbitrary telemetry data.
- SITL: A simulation for the plane so we can test the system with fake telemetry data.

## Dependencies

- go 1.19
- [docker](https://docs.docker.com/engine/install/)
- [docker-compose](https://docs.docker.com/compose/install/) (needed to run hub concurrently with [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot))
- [golangci-lint](https://github.com/golangci/golangci-lint)
- [goimports](https://pkg.go.dev/golang.org/x/tools/cmd/goimports)
- [protoc](https://grpc.io/docs/protoc-installation/)
- [protoc-gen-go](https://grpc.io/docs/languages/go/quickstart/)
    - Note: you just need to install protoc-gen-go, you don't need to install grpc using the second `go install` command.
- [npm](https://github.com/nvm-sh/nvm#install--update-script)
    - Note: you may already have npm installed on your system. However, if it is not a new enough version you will need to update. The linked tool will allow you to manage different versions of `npm` on your system. Follow the instructions to install the newest version of `npm`.

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

Verify that you have `protoc` and `protoc-gen-go` installed by this point.

Then, make sure you have all of the `npm` packages for the frontend installed.

```sh
cd houston
npm install
cd .. # go back into the root directory
```

If you receive an error, it is likely that your version of `npm` is too old. Go to the above link to install `nvm` (node version manager), to install a newer version of `npm`.

Then, to make sure you have the protobufs git submodule loaded, run the following make command.

```sh
make install-protos
```

This should be all of the first time setup you need. 

## Build

``` sh
# Build local gcs executable
make build

# Build Docker image for gcs 
make build-docker

# Update protobuf files (if needed)
make build-protos
```

Note that running docker commands may require sudo. 

## Run

``` sh
# Run gcs with testuser locally
make run

# Run docker image of gcs 
make run-docker
```

Run full hub workflow with multiple components (Includes [Influxdb](https://www.influxdata.com/products/influxdb/), [Grafana](https://grafana.com/oss/grafana/) and [SITL](https://github.com/tritonuas/ottopilot))
``` sh
make run-compose
```

### Stop Compose
``` sh
# Stop docker-compose workflow
make stop-compose
```

### Shortcuts
``` sh
# stop compose, then rebuild hub, then restart compose
make develop
```

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
