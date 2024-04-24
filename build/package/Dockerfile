FROM golang:1.19

# install n to install a newer version of node
# RUN curl -L https://bit.ly/n-install | bash
# RUN n install 21.7.2

# ENV NODE_VERSION=21.7.2
# ENV NVM_DIR /tmp/nvm
# WORKDIR $NVM_DIR
#
# RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
#   && . $NVM_DIR/nvm.sh \
#   && nvm install $NODE_VERSION \
#   && nvm alias default $NODE_VERSION \
#   && nvm use default
#
# ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
# ENV PATH      $NVM_DIR/v$NODE_VERSION/bin:$PATH
#
# RUN node --version

RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \ 
    && apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y build-essential \
                          protobuf-compiler \
                         curl gnupg -yq \
    && curl -sL https://deb.nodesource.com/setup_21.x | bash \
    && apt-get install nodejs -yq

RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28

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
COPY . .
WORKDIR /build/houston
RUN npm install
WORKDIR /build
RUN make build-protos

# RUN go build
RUN --mount=target=. \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /output/gcs .

RUN npm run --prefix ./houston build
# COPY ./houston/dist/ /build/houston/

RUN mkdir /CSV
# go build mounts code read-only without copying to container,
# so you have to put binary in another folder
CMD ["/output/gcs"]
