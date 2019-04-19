FROM golang:1.12
RUN curl https://glide.sh/get | sh
RUN mkdir -p /go/src/github.com/tritonuas/hub
WORKDIR /go/src/github.com/tritonuas/hub
COPY glide.yaml .
COPY go-mavlink /go/src/github.com/tritonuas/go-mavlink/
ADD . /go/src/github.com/tritonuas/hub
RUN rm glide.lock
RUN mkdir -p /root/.glide/ && touch /root/.glide/mirrors.yaml
# install dependencies with glide
RUN glide mirror set https://github.com/tritonuas/go-mavlink file:///go/src/github.com/tritonuas/go-mavlink --vcs git
RUN glide install
RUN apt-get update && apt-get install -y libzmq3-dev
RUN go install 
CMD ["/go/bin/hub"]
