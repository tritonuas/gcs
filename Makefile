GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")
PACKAGES = $(shell go list -f '{{ join .Imports "\n" }}' )

.PHONY: all
all: build run

# Build
# --------------------------------------------------------------------
.PHONY: build configure-git compile-protos build-go docker-build
build: configure-git submodulesupdate compile-protos build-go

configure-git:
	git config --global url."git@github.com:".insteadOf "https://github.com/"

PROTOS_SRC_DIR = ./protos/interop
PROTOS_DST_DIR = ./internal/interop
compile-protos:
	protoc -I=$(PROTOS_SRC_DIR) --go_out=$(PROTOS_DST_DIR) $(PROTOS_SRC_DIR)/interop_api.proto

build-go:
	go build

docker-build:
	docker build -t tritonuas/hub --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} -f build/package/Dockerfile .

# Run
# --------------------------------------------------------------------
.PHONY: run docker-run
run:
	./hub

docker-run:
	docker run tritonuas/hub
#docker container run -e INTEROP_IP=127.0.0.1 -e INTEROP_PORT=8000 -e INTEROP_USER=ucsdauvsi -e INTEROP_PASS=tritons -e MAV_DEVICE=:5762 -e HUB_PATH=/go/src/github.com/tritonuas/hub --network host tritonuas/hub
#docker-compose up

# Cleanup
# --------------------------------------------------------------------
.PHONY: clean submodulesclean submodulesupdate

clean:
	rm hub **/*.pb.go

submodulesclean:
	git submodule foreach --recursive git clean --ff -x -d
	git submodule sync --recursive
	git submodule update --init --recusive --force

submodulesupdate:
	git submodule update --init --recursive || true
	git submodule sync --recursive
	git submodule update --init --recursive

# Testing
# --------------------------------------------------------------------
.PHONY: test
test:
	go test -race $(PACKAGES)

# Style/formatting
# --------------------------------------------------------------------
.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
