
# Install protoc-gen from the vendor dir to ensure interop with the runtime version
go install ./vendor/github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
go install ./vendor/github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger

protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --go_out=plugins=grpc:. \
  protos/interop/*.proto

protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --grpc-gateway_out=logtostderr=true:. \
  protos/interop/service.proto

protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor \
  -I$GOPATH/src/github.com/tritonuas/hub/vendor/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --swagger_out=logtostderr=true:. \
  protos/interop/service.proto

  cp interop/service.swagger.json third_party/swagger-ui
  rm interop/service.swagger.json
