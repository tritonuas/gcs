FROM golang:1.7
RUN curl https://glide.sh/get | sh
RUN mkdir -p /go/src/github.com/tritonuas/hub
WORKDIR /go/src/github.com/tritonuas/hub
COPY glide.yaml .
COPY glide.lock .
# install dependencies with glide
RUN glide install -s -v
ADD . /go/src/github.com/tritonuas/hub
ADD ./go-mavlink /go/src/github.com/tritonuas/go-mavlink
RUN go install 
CMD ["/go/bin/hub"]
