GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")

.PHONY: all
all: build run

# Dependencies
# --------------------------------------------------------------------
.PHONY: install-dependencies
install-dependencies:
	./scripts/install-go.sh
	./scripts/install-protoc.sh

# Build
# --------------------------------------------------------------------
.PHONY: pre-build build install-dependencies configure-git compile-protos build-go docker-build
pre-build: configure-git submodulesupdate compile-protos

build: build-go

configure-git:
	git config --global url."git@github.com:".insteadOf "https://github.com/"

PROTOS_SRC_DIR = ./protos/interop
PROTOS_DST_DIR = ./internal/interop
compile-protos:
	protoc -I=$(PROTOS_SRC_DIR) --go_out=$(PROTOS_DST_DIR) $(PROTOS_SRC_DIR)/interop_api.proto

build-go:
	go build

build-docker:
	docker build -t tritonuas/hub -f build/package/Dockerfile .

# Run
# --------------------------------------------------------------------
.PHONY: run docker-run
run:
	./hub -interop_user=testuser -interop_pass=testpass

run-docker:
	docker run -e INTEROP_USER=testuser -e INTEROP_PASS=testpass --network=host tritonuas/hub

run-compose:
	docker-compose -f deployments/docker-compose.yml up

# Cleanup
# --------------------------------------------------------------------
.PHONY: clean submodulesclean submodulesupdate

clean:
	rm hub **/*.pb.go

submodulesclean:
	git submodule foreach git clean --ff -x -d
	git submodule sync --recursive
	git submodule update --init --force

submodulesupdate:
	git submodule update --init || true
	git submodule sync
	git submodule update --init

# Testing
# --------------------------------------------------------------------
.PHONY: test

PACKAGES = $(shell go list -f '{{ join .Imports "\n" }}' )
test:
	go test -race $(PACKAGES)

# Style/formatting
# --------------------------------------------------------------------
.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
