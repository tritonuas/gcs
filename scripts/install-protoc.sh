#!/bin/bash

COMMAND=protoc
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Exit script if protobuf compiler already installed
if command -v  $COMMAND &> /dev/null; then
    echo -e "${BLUE}${COMMAND} already installed${NC}"
		protoc --version
		exit
fi

# Install protobuf-compiler on linux or OSX
echo -e "${RED}${COMMAND} could not be found"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
		echo -e "${BLUE}Installing protobuf compiler on ${OSTYPE}${NC}"
		if grep docker /proc/1/cgroup -qa; then
				apt install -y protobuf-compiler
		else
				sudo apt install -y protobuf-compiler
		fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
		echo -e "${BLUE}Installing protobuf compiler on ${OSTYPE}${NC}"
		brew install protobuf
else
		echo -e "${RED}$OSTYPE not currently supported for script install ${NC}"
		exit
fi

# Install protoc-gen-go for go compiling
echo -e "${BLUE}Installing protoc-gen-go${NC}"
go get google.golang.org/protobuf/cmd/protoc-gen-go

echo -e "${BLUE}Setting PATH for protoc-gen-go${NC}"
echo "export PATH='$PATH:$(go env GOPATH)/bin'" >> $HOME/.profile
