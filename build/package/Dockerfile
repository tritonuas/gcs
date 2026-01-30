FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY houston/package*.json ./houston/
WORKDIR /app/houston
RUN npm ci
COPY houston/ .
RUN npm run build

FROM golang:1.20

# Move to working directory /build
WORKDIR /build

# disable some optimizations that don't work everywhere
# ENV CGO_ENABLED=0

# Install protobuf stuf
RUN apt-get update && apt-get install -y protobuf-compiler
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28

# copy over go.mod and go.sum
COPY go.* ./

# `docker builder prune`: will force to have up to date packages
# contents of /go/pkg/mod get saved by docker so it doesn't repull every time
# in any case the deps are in a separate layer so this will not run normally
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
# RUN go mod download

# Copy source code
COPY . .

# Generate Protos (depends on source being present, particularly protos/)
# We copy everything so existing internal/protos (if any) are there, but we regenerate.
# Since internal/protos is in .gitignore, it likely won't be copied from host if clean.
RUN protoc -I=./protos/ --go_out=./internal/protos/ --go_opt=paths=source_relative ./protos/houston.proto
RUN protoc -I=./protos/ --go_out=./internal/protos/ --go_opt=paths=source_relative ./protos/obc.proto

# Build gcs
# Use cache mounts for deps but NOT for source (target=.) because it overlays the generated protos
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /output/gcs .

COPY --from=frontend-builder /app/houston/dist/ /build/houston/

RUN mkdir /CSV
# go build mounts code read-only without copying to container,
# so you have to put binary in another folder
CMD ["/output/gcs"]
