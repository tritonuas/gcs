PACKAGES := $(shell glide novendor)
GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")

all: build run

build-docker: install
	docker build . -t tritonuas/hub

.PHONY: build
build: build-hub

docker-run:
	docker run tritonuas/hub

local-build:
	cp -rf . ${GOPATH}/src/github.com/tritonuas/hub/
	cd ${GOPATH}/src/github.com/tritonuas/hub/ && make install

local-run:
	${GOPATH}/bin/hub

.PHONY: dep
dep:
	glide --version || curl https://glide.sh/get | sh
	glide install

.PHONY: install
install:
	glide install
	go install

.PHONY: test
test:
	# add -race
	go test -race $(PACKAGES)

.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
