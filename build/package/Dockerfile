FROM golang:1.14

# Move to working directory /build
WORKDIR /build

# Install some necessary dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    libzmq3-dev \
	protobuf-compiler \
 && rm -rf /var/lib/apt/lists/*

# Install protoc compilation for golang
RUN go get google.golang.org/protobuf/cmd/protoc-gen-go

COPY . .
# Compile protobufs for golang
RUN make compile-protos

# Build hub
RUN go build

CMD ["./hub"]
