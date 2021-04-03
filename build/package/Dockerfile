FROM golang:1.14

# Move to working directory /build
WORKDIR /build
COPY . .

# Install some necessary dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    git \
    libzmq3-dev \
 && rm -rf /var/lib/apt/lists/*

# Setup git to use ssh for private go modules
RUN make install-dependencies
RUN make build

CMD ["./hub"]
