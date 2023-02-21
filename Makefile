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
.PHONY: run run-docker run-compose stop-compose run-broach-compose develop
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

develop:
	make stop-compose && make build-docker && make run-compose

# Testing
# --------------------------------------------------------------------
.PHONY: test

test:
	go test -race ./...

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
