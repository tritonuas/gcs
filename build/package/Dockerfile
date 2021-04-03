FROM golang:1.14

# Move to working directory /build
WORKDIR /build
COPY . .

# Install some necessary dependencies
RUN apt-get update
RUN apt-get -y install git libzmq3-dev

# Setup git to use ssh for private go modules
RUN make install-dependencies
RUN make build

CMD ["./hub"]
