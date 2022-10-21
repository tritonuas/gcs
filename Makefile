GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")

.PHONY: all
all: build run

# Dependencies
# --------------------------------------------------------------------
.PHONY: install-dependencies
install-dependencies:
	./scripts/install-go.sh

# Build
# --------------------------------------------------------------------
.PHONY: pre-build build install-dependencies configure-git build-go build-docker
pre-build: configure-git 

build: build-go

configure-git:
	git config --global url."git@github.com:".insteadOf "https://github.com/"

build-go:
	go build

build-docker:
	docker build -t tritonuas/hub -f build/package/Dockerfile .

# Run
# --------------------------------------------------------------------
.PHONY: run run-docker run-compose stop-compose run-broach-compose
run:
	./hub -interop_user=testuser -interop_pass=testpass

run-docker:
	docker run -e INTEROP_USER=testuser -e INTEROP_PASS=testpass --network=host --name hub tritonuas/hub

run-compose:
	docker-compose -f deployments/docker-compose.yml up -d

stop-compose:
	docker-compose -f deployments/docker-compose.yml down

run-broach-compose:
	docker-compose -f deployments/broach-docker-compose.yml up -d
	
stop-broach-compose:
	docker-compose -f deployments/broach-docker-compose.yml down

# Testing
# --------------------------------------------------------------------
.PHONY: test

test:
	go test -race ./...

# Style/formatting
# --------------------------------------------------------------------
.PHONY: fmt
fmt:
	gofmt -w -l $(GOFILES_NOVENDOR)
