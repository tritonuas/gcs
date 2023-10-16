GOFILES_NOVENDOR = $(shell find . -type f -name '*.go' -not -path "./vendor/*")
OS := $(shell uname)

.PHONY: all
all: build run

# Dependencies
# --------------------------------------------------------------------
.PHONY: install-linter
install-linter:
	# TODO: might as well just move this all to an install-linter script
	$(info Installing golangci-lint for $(OS))
	@if [ $(OS) = "Darwin" ] ; then\
		brew install golangci-lint;\
		brew upgrade golangci-lint;\
	elif [ $(OS) = "Linux" ] ; then\
		./scripts/install-linter-linux.sh ;\
	fi;\

install-fmter:
	go install golang.org/x/tools/cmd/goimports@latest

install-assets:
	./scripts/pull-large-assets.sh

# Build
# --------------------------------------------------------------------
.PHONY: pre-build build install-dependencies configure-git build-go build-react build-docker
pre-build: configure-git 

build: build-go build-react

configure-git:
	git config --global url."git@github.com:".insteadOf "https://github.com/"

build-go:
	go build

build-react:
	npm run --prefix ./houston build

build-docker: build-react
	DOCKER_BUILDKIT=1 docker build -t tritonuas/gcs -f build/package/Dockerfile .

# Run
# --------------------------------------------------------------------
.PHONY: run run-docker run-compose stop-compose run-broach-compose develop
run: build
	./gcs

run-react-dev:
	npm run --prefix ./houston dev

run-docker:
	docker run -e --network=host --name gcs tritonuas/gcs

run-compose:
	docker-compose -f deployments/docker-compose.yml up -d

stop-compose:
	docker-compose -f deployments/docker-compose.yml down

run-broach-compose:
	docker-compose -f deployments/broach-docker-compose.yml up -d
	
stop-broach-compose:
	docker-compose -f deployments/broach-docker-compose.yml down

develop:
	make stop-compose && make build-docker && make run-compose

# Testing
# --------------------------------------------------------------------
.PHONY: test test-all clear-cache

test:
	go test -race ./...

test-all: clear-cache test

clear-cache:
	go clean -testcache

# Style/formatting
# --------------------------------------------------------------------
.PHONY: fmt
fmt:
	goimports -w -l $(GOFILES_NOVENDOR)

# Linting
# --------------------------------------------------------------------
.PHONY: lint 
lint:
	golangci-lint run
