FROM golang:1.19

# Move to working directory /build
WORKDIR /build

# disable some optimizations that don't work everywhere
# ENV CGO_ENABLED=0

# copy over go.mod and go.sum
COPY go.* ./

# `docker builder prune`: will force to have up to date packages
# contents of /go/pkg/mod get saved by docker so it doesn't repull every time
# in any case the deps are in a separate layer so this will not run normally
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
# RUN go mod download

# Build gcs
# COPY . .
# RUN go build
RUN --mount=target=. \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /output/gcs .

COPY ./houston/dist/ /build/houston/

RUN mkdir /CSV
# go build mounts code read-only without copying to container,
# so you have to put binary in another folder
CMD ["/output/gcs"]
