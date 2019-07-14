FROM golang:1.12
RUN mkdir -p /go/src/github.com/tritonuas/hub
WORKDIR /go/src/github.com/tritonuas/hub
COPY glide.yaml .
ADD . /go/src/github.com/tritonuas/hub
RUN apt-get update && apt-get install -y libzmq3-dev
RUN go install 
CMD ["/go/bin/hub", "-env_var"]
