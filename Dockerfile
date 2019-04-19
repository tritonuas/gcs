FROM golang:1.12
RUN curl https://glide.sh/get | sh
RUN mkdir -p /go/src/github.com/tritonuas/hub
WORKDIR /go/src/github.com/tritonuas/hub
COPY glide.yaml .
COPY glide.lock .
# install dependencies with glide
#RUN glide install -s -v
ADD . /go/src/github.com/tritonuas/hub
RUN apt-get update && apt-get install -y libzmq3-dev
RUN go install 
CMD ["/go/bin/hub"]
