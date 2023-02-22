FROM golang:1.19

# Move to working directory /build
WORKDIR /build

COPY . .


# Build gcs
RUN go build

CMD ["./gcs"]
