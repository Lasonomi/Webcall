package voice

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Participant is a user currently inside a voice channel.
type Participant struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	PeerID      string `json:"peer_id"`
	Muted       bool   `json:"muted"`
	Deafened    bool   `json:"deafened"`
	ChannelID   string `json:"channel_id"`
	ServerID    string `json:"server_id"`
}

type client struct {
	conn        *websocket.Conn
	userID      string
	username    string
	displayName string
	peerID      string
	channelID   string
	serverID    string
	muted       bool
	deafened    bool
	send        chan []byte
}

// Hub manages voice rooms and WebSocket signaling (mesh coordination).
type callSession struct {
	CallerID string
	CalleeID string
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*client]bool
	// channelID -> userID -> client
	rooms map[string]map[string]*client
	// userID -> client (one realtime RTC socket per user)
	byUser        map[string]*client
	calls         map[string]callSession
	activeCall    map[string]string
	register      chan *client
	unregister    chan *client
	upgrader      websocket.Upgrader
	authorizeJoin func(userID, serverID, channelID, peerID string) error
}

func NewHub(allowedOrigin string) *Hub {
	h := &Hub{
		clients:    make(map[*client]bool),
		rooms:      make(map[string]map[string]*client),
		byUser:     make(map[string]*client),
		calls:      make(map[string]callSession),
		activeCall: make(map[string]string),
		register:   make(chan *client),
		unregister: make(chan *client),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if allowedOrigin == "" || allowedOrigin == "*" {
					return true
				}
				return origin == allowedOrigin || origin == ""
			},
		},
	}
	go h.run()
	return h
}

func (h *Hub) SetJoinAuthorizer(fn func(userID, serverID, channelID, peerID string) error) {
	h.authorizeJoin = fn
}

func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			// Drop previous session for same user
			if prev, ok := h.byUser[c.userID]; ok {
				h.removeClientLocked(prev)
			}
			h.clients[c] = true
			h.byUser[c.userID] = c
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			h.removeClientLocked(c)
			h.mu.Unlock()
		}
	}
}

func (h *Hub) removeClientLocked(c *client) {
	if c == nil {
		return
	}
	if _, ok := h.clients[c]; !ok {
		return
	}
	delete(h.clients, c)
	if h.byUser[c.userID] == c {
		delete(h.byUser, c.userID)
	}
	for sessionID, call := range h.calls {
		if call.CallerID != c.userID && call.CalleeID != c.userID {
			continue
		}
		otherID := call.CallerID
		if otherID == c.userID {
			otherID = call.CalleeID
		}
		if other := h.byUser[otherID]; other != nil {
			h.sendTo(other, map[string]any{"type": "call:end", "from": c.userID, "session_id": sessionID})
		}
		delete(h.calls, sessionID)
		delete(h.activeCall, call.CallerID)
		delete(h.activeCall, call.CalleeID)
	}
	if c.channelID != "" {
		room := h.rooms[c.channelID]
		if room != nil {
			delete(room, c.userID)
			if len(room) == 0 {
				delete(h.rooms, c.channelID)
			} else {
				// notify remaining
				h.broadcastRoomLocked(c.channelID, map[string]any{
					"type":       "voice:leave",
					"channel_id": c.channelID,
					"server_id":  c.serverID,
					"user": map[string]any{
						"user_id":      c.userID,
						"username":     c.username,
						"display_name": c.displayName,
						"peer_id":      c.peerID,
					},
					"participants": h.roomParticipantsLocked(c.channelID),
				}, nil)
			}
		}
	}
	close(c.send)
	_ = c.conn.Close()
}

func (h *Hub) roomParticipantsLocked(channelID string) []Participant {
	room := h.rooms[channelID]
	out := make([]Participant, 0, len(room))
	for _, c := range room {
		out = append(out, Participant{
			UserID:      c.userID,
			Username:    c.username,
			DisplayName: c.displayName,
			PeerID:      c.peerID,
			Muted:       c.muted,
			Deafened:    c.deafened,
			ChannelID:   c.channelID,
			ServerID:    c.serverID,
		})
	}
	return out
}

func (h *Hub) broadcastRoomLocked(channelID string, payload any, exclude *client) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	room := h.rooms[channelID]
	for _, c := range room {
		if c == exclude {
			continue
		}
		select {
		case c.send <- data:
		default:
			// slow client — drop
		}
	}
}

func (h *Hub) sendTo(c *client, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}

// ListChannel returns current participants in a voice channel.
func (h *Hub) ListChannel(channelID string) []Participant {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.roomParticipantsLocked(channelID)
}

// ServeWS upgrades the connection and runs read/write pumps.
// Membership must already be verified by the HTTP handler.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request, userID, username, displayName string) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("voice ws upgrade: %v", err)
		return
	}
	c := &client{
		conn:        conn,
		userID:      userID,
		username:    username,
		displayName: displayName,
		send:        make(chan []byte, 32),
	}
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
	defer func() {
		h.unregister <- c
	}()
	c.conn.SetReadLimit(64 << 10)
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
		case "voice:join":
			h.handleJoin(c, msg)
		case "voice:leave":
			h.handleLeave(c)
		case "voice:mute":
			h.handleMuteState(c, true, false)
		case "voice:unmute":
			h.handleMuteState(c, false, false)
		case "voice:deafen":
			h.handleMuteState(c, c.muted, true)
		case "voice:undeafen":
			h.handleMuteState(c, c.muted, false)
		case "voice:state":
			// full state update: muted + deafened
			muted, _ := msg["muted"].(bool)
			deafened, _ := msg["deafened"].(bool)
			h.handleMuteState(c, muted, deafened)
		case "call:invite":
			h.handleCallInvite(c, msg)
		case "call:accept", "call:reject", "call:cancel", "call:busy", "call:end":
			h.handleCallState(c, msg)
		case "rtc:signal":
			h.handleRTCSignal(c, msg)
		case "signal":
			// Mesh signaling relay: { type, to, from, data }
			h.handleSignal(c, msg)
		case "ping":
			h.sendTo(c, map[string]any{"type": "pong"})
		}
	}
}

func (h *Hub) handleJoin(c *client, msg map[string]any) {
	channelID, _ := msg["channel_id"].(string)
	serverID, _ := msg["server_id"].(string)
	peerID, _ := msg["peer_id"].(string)
	if channelID == "" || serverID == "" || peerID == "" {
		h.sendTo(c, map[string]any{"type": "error", "message": "channel_id, server_id, and peer_id are required"})
		return
	}
	if h.authorizeJoin != nil {
		if err := h.authorizeJoin(c.userID, serverID, channelID, peerID); err != nil {
			h.sendTo(c, map[string]any{"type": "error", "message": err.Error()})
			return
		}
	}

	h.mu.Lock()
	// leave previous channel if any
	if c.channelID != "" && c.channelID != channelID {
		if room := h.rooms[c.channelID]; room != nil {
			delete(room, c.userID)
			if len(room) == 0 {
				delete(h.rooms, c.channelID)
			} else {
				h.broadcastRoomLocked(c.channelID, map[string]any{
					"type":       "voice:leave",
					"channel_id": c.channelID,
					"server_id":  c.serverID,
					"user": map[string]any{
						"user_id": c.userID, "username": c.username,
						"display_name": c.displayName, "peer_id": c.peerID,
					},
					"participants": h.roomParticipantsLocked(c.channelID),
				}, c)
			}
		}
	}

	c.channelID = channelID
	c.serverID = serverID
	c.peerID = peerID
	c.muted = false
	c.deafened = false
	if _, ok := msg["muted"].(bool); ok {
		c.muted, _ = msg["muted"].(bool)
	}
	if _, ok := msg["deafened"].(bool); ok {
		c.deafened, _ = msg["deafened"].(bool)
	}

	if h.rooms[channelID] == nil {
		h.rooms[channelID] = make(map[string]*client)
	}
	h.rooms[channelID][c.userID] = c
	participants := h.roomParticipantsLocked(channelID)

	// ack to joiner
	h.sendTo(c, map[string]any{
		"type":         "voice:joined",
		"channel_id":   channelID,
		"server_id":    serverID,
		"participants": participants,
	})
	// notify others
	h.broadcastRoomLocked(channelID, map[string]any{
		"type":       "voice:join",
		"channel_id": channelID,
		"server_id":  serverID,
		"user": map[string]any{
			"user_id":      c.userID,
			"username":     c.username,
			"display_name": c.displayName,
			"peer_id":      c.peerID,
			"muted":        c.muted,
			"deafened":     c.deafened,
		},
		"participants": participants,
	}, c)
	h.mu.Unlock()
}

func (h *Hub) handleLeave(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.channelID == "" {
		return
	}
	channelID := c.channelID
	serverID := c.serverID
	if room := h.rooms[channelID]; room != nil {
		delete(room, c.userID)
		if len(room) == 0 {
			delete(h.rooms, channelID)
		} else {
			h.broadcastRoomLocked(channelID, map[string]any{
				"type":       "voice:leave",
				"channel_id": channelID,
				"server_id":  serverID,
				"user": map[string]any{
					"user_id": c.userID, "username": c.username,
					"display_name": c.displayName, "peer_id": c.peerID,
				},
				"participants": h.roomParticipantsLocked(channelID),
			}, c)
		}
	}
	c.channelID = ""
	c.serverID = ""
	h.sendTo(c, map[string]any{"type": "voice:left", "channel_id": channelID})
}

func (h *Hub) handleMuteState(c *client, muted, deafened bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c.muted = muted
	c.deafened = deafened
	if c.channelID == "" {
		return
	}
	h.broadcastRoomLocked(c.channelID, map[string]any{
		"type":       "voice:state",
		"channel_id": c.channelID,
		"user": map[string]any{
			"user_id":      c.userID,
			"username":     c.username,
			"display_name": c.displayName,
			"peer_id":      c.peerID,
			"muted":        c.muted,
			"deafened":     c.deafened,
		},
		"participants": h.roomParticipantsLocked(c.channelID),
	}, nil)
}

func (h *Hub) handleCallInvite(c *client, msg map[string]any) {
	to, _ := msg["to"].(string)
	sessionID, _ := msg["session_id"].(string)
	if to == "" || sessionID == "" || to == c.userID {
		h.sendTo(c, map[string]any{"type": "error", "message": "invalid call target"})
		return
	}

	h.mu.Lock()
	target := h.byUser[to]
	_, callerBusy := h.activeCall[c.userID]
	_, targetBusy := h.activeCall[to]
	if target != nil && target.channelID != "" {
		targetBusy = true
	}
	if target == nil || callerBusy || targetBusy || c.channelID != "" {
		h.mu.Unlock()
		h.sendTo(c, map[string]any{"type": "call:busy", "from": to, "session_id": sessionID})
		return
	}

	h.calls[sessionID] = callSession{CallerID: c.userID, CalleeID: to}
	h.activeCall[c.userID] = sessionID
	h.activeCall[to] = sessionID
	payload := map[string]any{
		"type": "call:invite", "from": c.userID, "session_id": sessionID, "mode": msg["mode"],
		"from_user": map[string]any{"user_id": c.userID, "username": c.username, "display_name": c.displayName},
	}
	h.mu.Unlock()
	h.sendTo(target, payload)
}

func (h *Hub) handleCallState(c *client, msg map[string]any) {
	to, _ := msg["to"].(string)
	sessionID, _ := msg["session_id"].(string)
	if to == "" || sessionID == "" {
		return
	}
	h.mu.Lock()
	call, ok := h.calls[sessionID]
	validPair := ok && ((call.CallerID == c.userID && call.CalleeID == to) || (call.CalleeID == c.userID && call.CallerID == to))
	if !validPair {
		h.mu.Unlock()
		return
	}
	target := h.byUser[to]
	typ, _ := msg["type"].(string)
	if typ != "call:accept" {
		delete(h.calls, sessionID)
		delete(h.activeCall, call.CallerID)
		delete(h.activeCall, call.CalleeID)
	}
	h.mu.Unlock()
	if target != nil {
		h.sendTo(target, map[string]any{"type": typ, "from": c.userID, "session_id": sessionID})
	}
}

func (h *Hub) handleRTCSignal(c *client, msg map[string]any) {
	to, _ := msg["to"].(string)
	scope, _ := msg["scope"].(string)
	sessionID, _ := msg["session_id"].(string)
	if to == "" || sessionID == "" || to == c.userID {
		return
	}
	h.mu.RLock()
	target := h.byUser[to]
	allowed := false
	if scope == "voice" {
		allowed = c.channelID != "" && c.channelID == sessionID && target != nil && target.channelID == c.channelID
	} else {
		call, ok := h.calls[sessionID]
		allowed = ok && ((call.CallerID == c.userID && call.CalleeID == to) || (call.CalleeID == c.userID && call.CallerID == to))
	}
	h.mu.RUnlock()
	if target == nil || !allowed {
		return
	}
	msg["from"] = c.userID
	h.sendTo(target, msg)
}

func (h *Hub) handleSignal(c *client, msg map[string]any) {
	to, _ := msg["to"].(string)
	if to == "" || to == c.userID {
		return
	}
	h.mu.RLock()
	target := h.byUser[to]
	h.mu.RUnlock()
	if target == nil {
		return
	}
	// stamp from
	msg["from"] = c.userID
	msg["from_peer"] = c.peerID
	h.sendTo(target, msg)
}
