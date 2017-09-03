all:
	openssl req -x509 -nodes -newkey rsa:2048 -keyout server.rsa.key -out server.rsa.crt -days 3650
	mv server.rsa.key server.key
	mv server.rsa.crt server.crt
	echo "place these file into certs.go"
