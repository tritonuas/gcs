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

install-protos:
	git submodule init && git submodule update

install-fmter:
	go install golang.org/x/tools/cmd/goimports@latest

install-assets:
	./scripts/pull-large-assets.sh

# Build
# --------------------------------------------------------------------
.PHONY: pre-build build install-dependencies configure-git build-go build-react build-docker build-protos build-backend-protos build-frontend-protos
pre-build: configure-git 

build: build-go build-react build-protos

configure-git:
	git config --global url."git@github.com:".insteadOf "https://github.com/"

build-go:
	go build

build-react:
	npm run --prefix ./houston build

build-docker: build-react build-protos
	DOCKER_BUILDKIT=1 docker build -t tritonuas/gcs -f build/package/Dockerfile .

build-protos: build-backend-protos build-frontend-protos

build-backend-protos: internal/protos/houston.pb.go

internal/protos/houston.pb.go: protos/houston.proto
	protoc -I=./protos/ --go_out=./internal/protos/ --go_opt=paths=source_relative ./protos/houston.proto

build-frontend-protos: houston/src/protos/houston.pb.ts

houston/src/protos/houston.pb.ts: protos/houston.proto
	protoc --plugin=houston/node_modules/.bin/protoc-gen-ts_proto --ts_proto_opt=fileSuffix=.pb --ts_proto_out=./houston/src/ ./protos/houston.proto


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
	docker compose -f deployments/docker-compose.yml up -d

stop-compose:
	docker compose -f deployments/docker-compose.yml down

run-broach-compose:
	docker compose -f deployments/broach-docker-compose.yml up -d
	
stop-broach-compose:
	docker compose -f deployments/broach-docker-compose.yml down

develop:
	make stop-compose && make build-docker && make run-compose

# Testing
# --------------------------------------------------------------------
.PHONY: test test-all clear-cache

test:
	go test -race ./... && cd houston && npm test

# clears go cache before running tests
test-all: clear-cache test && cd houston && npm test

test-frontend:
	cd houston && npm test

test-backend:
	go test -race ./...

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
	golangci-lint run && cd houston && npm run lint

lint-frontend:
	cd houston && npm run lint

lint-backend:
	golangci-lint run
