# Hub

[![Linting](https://github.com/tritonuas/hub/workflows/Linting/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ALinting)
[![Tests](https://github.com/tritonuas/hub/workflows/Tests/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ATests)
[![Docker](https://github.com/tritonuas/hub/workflows/Docker/badge.svg)](https://github.com/tritonuas/hub/actions?query=workflow%3ADocker)



Hub is a backend webserver that faciliates communication between many other modules in the TUAS system, including [Houston](https://github.com/tritonuas/houston), [OBC](https://github.com/tritonuas/planeobc), Mavproxy, and more. It also communicates with the [Interop Judging Server](https://github.com/auvsi-suas/interop) to grab the mission plans and submit waypoints.  
As of now, it does NOT deal with computer vision stuff; for that, see [matts-new-glasses](https://github.com/tritonuas/matts-new-glasses).  

The hub is currently hosted on [Dockerhub](https://hub.docker.com/repository/docker/tritonuas/hub).

## Dependencies

- [go 1.14](https://golang.org/)

## Usage

### Local

```sh
# Configure global git url to use ssh method:
git config --global url."git@github.com:".insteadOf "https://github.com/"
# Build go application
go build
```

or 

```sh
# Runs above commands
make 
```

NOTE: changing git url is only necesssary when [go-mavlink](https://github.com/tritonuas/go-mavlink) 
is private. This causes authentication issues when pulling the private module


hub is running if you see logs printed out, like below.

![logs](./screenshots/logs.png)  

### Docker

```sh
# build docker image
docker build -t tritonuas/hub --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} . 
or 
make docker-build

# Run docker container
docker run tritonuas/hub
or
make docker-run

# push to dockerhub; replace 1.x.x with the version you want to create.
docker push tritonuas/hub:1.x.x
```

## Swagger UI

To view the Swagger-UI docs without running the server, go into the third_party/swagger-ui folder and run `python3 -m http.server`. Then, go to localhost:8000 on your browser.

![swagger-screenshot](./screenshots/swagger.png)

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


