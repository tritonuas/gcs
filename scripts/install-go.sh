#!/bin/bash

COMMAND=go
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color
VERSION=1.15.5

if command -v  $COMMAND &> /dev/null; then
    echo -e "${BLUE}${COMMAND} already installed${NC}"
    exit
fi

echo -e "${RED}${COMMAND} could not be found${NC}"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    GOFILE=go${VERSION}.linux-amd-64.tar.gz
    curl https://golang.org/dl/${GOFILE}
    tar -C /usr/local -xzf ${GOFILE}
    echo "export PATH=$PATH:/usr/local/go/bin" >> "$HOME/.profile"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${RED}$OSTYPE not currently supported for script install ${NC}"
    # Test on OSX for go install
else
    echo -e "${RED}$OSTYPE not currently supported for script install ${NC}"
    exit
fi
