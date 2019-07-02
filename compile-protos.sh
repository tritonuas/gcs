
# Install protoc-gen from the vendor dir to ensure interop with the runtime version
#go install ./vendor/github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
#go install ./vendor/github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger

#go get -u github.com/grpc-ecosystem/grpc-gateway/protoc-gen-grpc-gateway
#go get -u github.com/grpc-ecosystem/grpc-gateway/protoc-gen-swagger
#go get -u github.com/golang/protobuf/protoc-gen-go

#protoc -I/usr/local/include -Iprotos \
  #-I$GOPATH/src/github.com/tritonuas/hub/vendor \
  #-I$GOPATH/src/github.com/tritonuas/hub/vendor/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  #-I$GOPATH/src/ \
  #-I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  #--go_out=plugins=grpc:. \
cd ../protos
protoc -I/usr/local/include -I. \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --go_out=plugins=grpc:. \
  interop/*.proto

#protoc -I/usr/local/include -I. \
#  -I$GOPATH/src \
#  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
#  --go_out=plugins=grpc:. \
#  pathplanner/*.proto


protoc -I/usr/local/include -I. \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --grpc-gateway_out=logtostderr=true:. \
  interop/service.proto

protoc -I/usr/local/include -I. \
  -I$GOPATH/src \
  -I$GOPATH/src/github.com/grpc-ecosystem/grpc-gateway/third_party/googleapis \
  --swagger_out=logtostderr=true:. \
  interop/service.proto

  cp interop/service.swagger.json ../hub/third_party/swagger-ui
  rm interop/service.swagger.json
  mv interop/*.go* ../hub/interop
  #rm interop/*.go*
  #cp pathplanner/*.go* ../hub/pathplanner
  #rm pathplanner/*.go*
