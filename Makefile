PACKAGES := $(shell glide novendor)
GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")

all: build run

local-deps:
	ls go-mavlink || git clone https://github.com/tritonuas/go-mavlink.git

build-hub:
	docker build . -t tritonuas/hub

.PHONY: build
build: local-deps build-hub

run:
	docker-compose up -d

down:
	docker-compose down

restart: down run

.PHONY: dep
dep:
	glide --version || curl https://glide.sh/get | sh
	glide install

.PHONY: install
install:
	go install

.PHONY: test
test:
	# add -race
	go test -race $(PACKAGES)

.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
