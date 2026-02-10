// Package websocket holds the websocket endpoint settings and implementations
package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"slices"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var allowedHost = map[string]bool{
	"http://localhost:3000":          true,
	"https://solveit.up.railway.app": true,
}

const (
	pongWait   = 90 * time.Second    // Time allowed to wait for the next pong from client
	pingPeriod = (pongWait * 9) / 10 // Send pings every 81 (before the read deadline expires)
	writeWait  = 10 * time.Second    // Time allowed to write a message to the client
)

type IncomingMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1 << 10,
	WriteBufferSize: 1 << 10,
	CheckOrigin: func(r *http.Request) bool {
		// allowedUrl := os.Getenv("NEXTAUTH_URL")
		origin := r.Header.Get("Origin")
		return allowedHost[origin] || os.Getenv("NEXTAUTH_URL") == origin
	},
}

type WebSockets struct {
	Hub      *WsHub
	Notif    *WsNotification
	Comments *WsComments
	Signal   *WsSignalling
	Chat     *WsMentorChat
}
type WsHub struct {
	conns map[string][]*websocket.Conn
	mu    sync.RWMutex
	// messageChan chan any
}

func NewHub() *WsHub {
	return &WsHub{
		conns: make(map[string][]*websocket.Conn),
	}
}

func NewWebSockets() *WebSockets {
	hub := NewHub()
	return &WebSockets{
		Hub:      hub,
		Notif:    NewWsNotification(hub),
		Comments: NewWsComments(hub),
		Chat:     NewMentorChat(hub),
		Signal:   NewWsWsSignalling(hub),
	}
}

func (h *WsHub) handleWS(w http.ResponseWriter, r *http.Request, appChan chan IncomingMessage) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("failed to upgrade conn:", err)
		return
	}
	conn.SetReadLimit(5 << 20)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	channelID := r.URL.Query().Get("channel")
	if channelID == "" {
		conn.Close()
		return
	}
	h.mu.Lock()
	h.conns[channelID] = append(h.conns[channelID], conn)
	h.mu.Unlock()

	go h.cleanUp(conn, channelID, appChan)
	go func() {
		ticker := time.NewTicker(pingPeriod)
		defer ticker.Stop()

		for range ticker.C {
			h.mu.RLock()
			stillActive := slices.Contains(h.conns[channelID], conn)
			h.mu.RUnlock()
			if !stillActive {
				return
			}

			conn.SetWriteDeadline(time.Now().Add(writeWait))

			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(writeWait)); err != nil {
				log.Printf("Ping failed for %s: %v (will retry next tick)", channelID, err)
				continue //
			}
		}
	}()

	log.Println("New connection for channel:", channelID)
}

func (h *WsHub) cleanUp(conn *websocket.Conn, channelID string, appChan chan IncomingMessage) {
	defer conn.Close()
	for {

		var msg IncomingMessage
		err := conn.ReadJSON(&msg)
		if err != nil {

			log.Printf("Read error on channel %s: %v", channelID, err)
			h.mu.Lock()
			conns := h.conns[channelID]
			active := conns[:0]
			for _, c := range conns {
				if c != conn {
					active = append(active, c)
				}
			}
			h.conns[channelID] = active
			h.mu.Unlock()

			break
		}
		switch msg.Type {
		case "PING":
			continue
		case "MESSAGE":
			select {
			case appChan <- msg:
			default:
				log.Println("WARN: Feature channel full, dropping message on channel:", channelID)
			}

		default:
			log.Printf("Received unknown message type: %s on channel %s", msg.Type, channelID)
		}
	}
}

func (h *WsHub) sendToChannel(channelID string, payload any) {
	h.mu.RLock()
	conns := append([]*websocket.Conn(nil), h.conns[channelID]...)
	h.mu.RUnlock()

	var alive []*websocket.Conn
	for _, conn := range conns {
		conn.SetWriteDeadline(time.Now().Add(writeWait))
		if err := conn.WriteJSON(payload); err != nil {
			log.Printf("Write error to %s: %v (Closing connection)", channelID, err)
			conn.Close()
			continue
		}
		alive = append(alive, conn)
	}

	h.mu.Lock()
	h.conns[channelID] = alive
	h.mu.Unlock()
}
