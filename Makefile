GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")
OS := $(shell uname)

.PHONY: all
all: build run

# Dependencies
# --------------------------------------------------------------------
.PHONY: install-dependencies
install-dependencies: install-linter
	./scripts/install-go.sh

.PHONY: install-linter
install-linter:
	$(info Installing golangci-lint for $(OS))
	@if [ $(OS) = "Darwin" ] ; then\
		brew install golangci-lint;\
		brew upgrade golangci-lint;\
	elif [ $(OS) = "Linux" ] ; then\
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.50.1 ;\
	fi;\

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
run: build
	./hub 

run-docker:
	docker run -e --network=host --name hub tritonuas/hub

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

# Linting
# --------------------------------------------------------------------
.PHONY: lint 
lint:
	golangci-lint run
