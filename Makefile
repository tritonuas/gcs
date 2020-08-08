#PACKAGES := $(shell glide novendor)
#GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")

.PHONY: all
all: build run

#.PHONY: docker-build
#docker-build: install
#  docker build . -t tritonuas/hub -f Dockerfile

#.PHONY: build
#build: docker-build

.PHONY: docker-run
#docker-run:
#  docker container run -e INTEROP_IP=127.0.0.1 -e INTEROP_PORT=8000 -e INTEROP_USER=ucsdauvsi -e INTEROP_PASS=tritons -e MAV_DEVICE=:5762 -e HUB_PATH=/go/src/github.com/tritonuas/hub --network host tritonuas/hub
	#docker-compose up

.PHONY: run
run:
	./hub

.PHONY: build
build:
	git config --global url."git@github.com:".insteadOf "https://github.com/"
	go build

.PHONY: test
test:
	# add -race
	go test -race $(PACKAGES)

.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)


# GO MODULES
.PHONY: getdeps
getdeps:
	export GOPRIVATE="github.com/tritonuas"
	go get
