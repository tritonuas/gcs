package main

import (
	"fmt"
	"log"
	"net"
)

type TCPServer struct {
	listenAddr string
	ln         net.Listener
	quitch     chan struct{}
}

func initTCP(listenAddr string) *TCPServer {
	return &TCPServer{
		listenAddr: listenAddr,
		quitch:     make(chan struct{}),
	}
}

func (s *TCPServer) start() error {
	ln, err := net.Listen("tcp", s.listenAddr)
	if err != nil {
		return err
	}

	defer ln.Close()
	s.ln = ln

	go s.handleConnection()

	<-s.quitch

	return nil
}

func (s *TCPServer) handleConnection() {
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			fmt.Println("Accept Error:", err)
			continue
		}

		fmt.Println("New Connection: ", conn.RemoteAddr())

		go s.readLoop(conn)
	}
}

func (s *TCPServer) readLoop(conn net.Conn) {
	defer conn.Close()
	buf := make([]byte, 2048) // Needs to be big enough for message
	for {
		n, err := conn.Read(buf)
		if err != nil {
			fmt.Println("read error", err)
			continue
		}
		msg := buf[:n]
		fmt.Println(string(msg))
	}

}

func main() {
	testserver := initTCP(":4345")
	log.Fatal(testserver.start())
}
