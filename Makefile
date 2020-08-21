GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")
PACKAGES = $(shell go list -f '{{ join .Imports "\n" }}' )

.PHONY: all
all: build run

.PHONY: docker-build
docker-build:
	docker build -t tritonuas/hub --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} -f build/package/Dockerfile .

.PHONY: docker-run
docker-run:
	docker run tritonuas/hub
	#docker container run -e INTEROP_IP=127.0.0.1 -e INTEROP_PORT=8000 -e INTEROP_USER=ucsdauvsi -e INTEROP_PASS=tritons -e MAV_DEVICE=:5762 -e HUB_PATH=/go/src/github.com/tritonuas/hub --network host tritonuas/hub
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
	go test -race $(PACKAGES)

.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
