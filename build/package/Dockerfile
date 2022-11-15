FROM golang:1.19

# Move to working directory /build
WORKDIR /build

COPY . .

# Build hub
RUN go build

CMD ["./hub"]
