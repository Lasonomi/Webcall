package realtime

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type client struct {
	conn   *websocket.Conn
	userID string
	send   chan []byte
}

// Hub delivers user-scoped realtime events (DM, typing, presence, notifications).
type Hub struct {
	mu         sync.RWMutex
	byUser     map[string]map[*client]bool
	register   chan *client
	unregister chan *client
	upgrader   websocket.Upgrader
	// optional: notify store when presence changes
	onPresence func(userID string, online bool)
}

func NewHub(allowedOrigin string) *Hub {
	h := &Hub{
		byUser:     make(map[string]map[*client]bool),
		register:   make(chan *client),
		unregister: make(chan *client),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
				if origin == "" {
					return true
				}
				for _, allowed := range strings.Split(allowedOrigin, ",") {
					allowed = strings.TrimRight(strings.TrimSpace(allowed), "/")
					if allowed == "*" || allowed == origin {
						return true
					}
				}
				return allowedOrigin == ""
			},
		},
	}
	go h.run()
	return h
}

func (h *Hub) SetPresenceHandler(fn func(userID string, online bool)) {
	h.onPresence = fn
}

func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			first := h.byUser[c.userID] == nil || len(h.byUser[c.userID]) == 0
			if h.byUser[c.userID] == nil {
				h.byUser[c.userID] = make(map[*client]bool)
			}
			h.byUser[c.userID][c] = true
			h.mu.Unlock()
			if first && h.onPresence != nil {
				h.onPresence(c.userID, true)
			}
		case c := <-h.unregister:
			h.mu.Lock()
			wentOffline := false
			if set := h.byUser[c.userID]; set != nil {
				if _, ok := set[c]; ok {
					delete(set, c)
					close(c.send)
					_ = c.conn.Close()
				}
				if len(set) == 0 {
					delete(h.byUser, c.userID)
					wentOffline = true
				}
			}
			uid := c.userID
			h.mu.Unlock()
			if wentOffline && h.onPresence != nil {
				h.onPresence(uid, false)
			}
		}
	}
}

func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.byUser[userID]) > 0
}

func (h *Hub) OnlineUserIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	ids := make([]string, 0, len(h.byUser))
	for uid := range h.byUser {
		ids = append(ids, uid)
	}
	return ids
}

// Publish sends an event to all sockets of the given user ids.
func (h *Hub) Publish(userIDs []string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, uid := range userIDs {
		for c := range h.byUser[uid] {
			select {
			case c.send <- data:
			default:
			}
		}
	}
}

// BroadcastAll sends to every connected user.
func (h *Hub) BroadcastAll(payload any) {
	h.Publish(h.OnlineUserIDs(), payload)
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request, userID string) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("realtime ws upgrade: %v", err)
		return
	}
	c := &client{conn: conn, userID: userID, send: make(chan []byte, 64)}
	h.register <- c
	go h.writePump(c)
	h.readPump(c)
}

func (h *Hub) writePump(c *client) {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		h.unregister <- c
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) readPump(c *client) {
	defer func() { h.unregister <- c }()
	c.conn.SetReadLimit(4096)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg map[string]any
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		typ, _ := msg["type"].(string)
		switch typ {
		case "ping":
			h.sendOne(c, map[string]any{"type": "pong"})
		case "dm:typing":
			// client already routes targets via Publish from HTTP in some setups;
			// allow client-side fanout by conversation peers if provided
			if targets, ok := msg["targets"].([]any); ok {
				ids := make([]string, 0, len(targets))
				for _, t := range targets {
					if s, ok := t.(string); ok && s != c.userID {
						ids = append(ids, s)
					}
				}
				h.Publish(ids, map[string]any{
					"type":            "dm:typing",
					"conversation_id": msg["conversation_id"],
					"user_id":         c.userID,
				})
			}
		case "channel:typing":
			if targets, ok := msg["targets"].([]any); ok {
				ids := make([]string, 0, len(targets))
				for _, t := range targets {
					if s, ok := t.(string); ok && s != c.userID {
						ids = append(ids, s)
					}
				}
				h.Publish(ids, map[string]any{
					"type":       "channel:typing",
					"server_id":  msg["server_id"],
					"channel_id": msg["channel_id"],
					"user_id":    c.userID,
				})
			}
		}
	}
}

func (h *Hub) sendOne(c *client, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}
