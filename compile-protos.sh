protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --go_out=plugins=grpc:. \
  protos/interop/*.proto

protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --grpc-gateway_out=logtostderr=true:. \
  protos/interop/service.proto

protoc -I/usr/local/include -Iprotos \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --swagger_out=logtostderr=true:. \
  protos/interop/service.proto

  cp interop/service.swagger.json third_party/swagger-ui