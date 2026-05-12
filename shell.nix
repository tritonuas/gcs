let
  pkgs = import <nixpkgs> {};
in pkgs.mkShell rec {
  name = "gcs";

  buildInputs = with pkgs; [
    gnumake

    go
    golangci-lint
    gotools

    nodejs

    protoc-gen-go
    protobuf
  ];

  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
