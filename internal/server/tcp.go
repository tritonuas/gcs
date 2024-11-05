package server

import (
	"fmt"
	"log"
	"net"
)

type Message struct {
	from    string
	payload []byte
}

type TCPServer struct {
	listenAddr string
	ln         net.Listener
	quitch     chan struct{}
	msgch      chan Message
}

func initTCP(listenAddr string) *TCPServer {
	return &TCPServer{
		listenAddr: listenAddr,
		quitch:     make(chan struct{}),
		msgch:      make(chan Message, 10),
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
	close(s.msgch)

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

		s.msgch <- Message{
			from:    conn.RemoteAddr().String(),
			payload: buf[:n],
		}

		conn.Write([]byte("Message Recieved"))

	}

}

func main() {
	testserver := initTCP(":4345")

	go func() {
		for msg := range testserver.msgch {
			fmt.Printf("recived message (%s):%s\n", msg.from, string(msg.payload))
		}
	}()

	log.Fatal(testserver.start())
}
