FROM golang:1.14

# Move to working directory /build
WORKDIR /build
COPY . .

# Install some necessary dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	libzmq3-dev \
	&& rm -rf /var/lib/apt/lists/*


# Setup git to use ssh for private go modules
# ARG GITHUB_TOKEN
# RUN git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadOf "https://github.com/"
RUN make install-dependencies
RUN make build

CMD ["./hub"]
