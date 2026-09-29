package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	appauth "webcall/backend/internal/auth"
	"webcall/backend/internal/realtime"
	"webcall/backend/internal/store"
	"webcall/backend/internal/voice"
)

type Router struct {
	store          *store.Store
	tokens         *appauth.Service
	frontendOrigin string
	voice          *voice.Hub
	rt             *realtime.Hub
}

type contextKey string

const userIDKey contextKey = "userID"

func NewRouter(st *store.Store, tokens *appauth.Service, frontendOrigin string) http.Handler {
	if strings.TrimSpace(frontendOrigin) == "" {
		frontendOrigin = "http://localhost:5173"
	}
	r := &Router{
		store:          st,
		tokens:         tokens,
		frontendOrigin: frontendOrigin,
		voice:          voice.NewHub(frontendOrigin),
		rt:             realtime.NewHub(frontendOrigin),
	}
	r.voice.SetJoinAuthorizer(func(userID, serverID, channelID, peerID string) error {
		actualServerID, _, _, err := st.GetVoiceChannel(channelID, userID)
		if err != nil {
			return err
		}
		if actualServerID != serverID {
			return errors.New("server and channel do not match")
		}
		user := st.GetByID(userID)
		if user == nil {
			return errors.New("user not found")
		}
		if strings.TrimSpace(user.PeerID) == "" || strings.TrimSpace(user.PeerID) != strings.TrimSpace(peerID) {
			return errors.New("invalid peer id")
		}
		return nil
	})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", r.health)
	mux.Handle("POST /api/upload", r.auth(http.HandlerFunc(r.uploadFile)))
	mux.HandleFunc("GET /uploads/{file}", r.serveUpload)
	mux.HandleFunc("GET /uploads/", r.serveUpload)
	mux.HandleFunc("POST /api/auth/register", r.register)
	mux.HandleFunc("POST /api/auth/login", r.login)
	mux.Handle("/api/me", r.auth(http.HandlerFunc(r.me)))
	mux.Handle("/api/me/peer", r.auth(http.HandlerFunc(r.peer)))
	mux.Handle("/api/users", r.auth(http.HandlerFunc(r.users)))
	mux.Handle("/api/friends", r.auth(http.HandlerFunc(r.friends)))
	mux.Handle("/api/friends/requests", r.auth(http.HandlerFunc(r.requests)))
	mux.Handle("/api/friends/request", r.auth(http.HandlerFunc(r.requestFriend)))
	mux.Handle("/api/friends/accept", r.auth(http.HandlerFunc(r.acceptFriend)))
	mux.Handle("/api/friends/reject", r.auth(http.HandlerFunc(r.rejectFriend)))
	mux.Handle("/api/friends/", r.auth(http.HandlerFunc(r.removeFriend)))

	// Server / Community endpoints (/api/servers and /servers)
	mux.Handle("GET /api/servers", r.auth(http.HandlerFunc(r.listServers)))
	mux.Handle("POST /api/servers", r.auth(http.HandlerFunc(r.createServer)))
	mux.Handle("POST /api/servers/join", r.auth(http.HandlerFunc(r.joinServerByInvite)))
	mux.Handle("GET /api/servers/{id}", r.auth(http.HandlerFunc(r.getServer)))
	mux.Handle("PATCH /api/servers/{id}", r.auth(http.HandlerFunc(r.updateServer)))
	mux.Handle("DELETE /api/servers/{id}", r.auth(http.HandlerFunc(r.deleteServer)))
	mux.Handle("POST /api/servers/{id}/join", r.auth(http.HandlerFunc(r.joinServer)))
	mux.Handle("POST /api/servers/{id}/leave", r.auth(http.HandlerFunc(r.leaveServer)))
	mux.Handle("GET /api/servers/{id}/invites", r.auth(http.HandlerFunc(r.listInvites)))
	mux.Handle("POST /api/servers/{id}/invites", r.auth(http.HandlerFunc(r.createInvite)))
	mux.Handle("GET /api/servers/{id}/members", r.auth(http.HandlerFunc(r.listMembers)))
	mux.Handle("GET /api/servers/{id}/channels/{channelId}/messages", r.auth(http.HandlerFunc(r.listChannelMessages)))
	mux.Handle("POST /api/servers/{id}/channels/{channelId}/messages", r.auth(http.HandlerFunc(r.createChannelMessage)))
	mux.Handle("PATCH /api/channel-messages/{messageId}", r.auth(http.HandlerFunc(r.updateChannelMessage)))
	mux.Handle("DELETE /api/channel-messages/{messageId}", r.auth(http.HandlerFunc(r.deleteChannelMessage)))
	mux.Handle("POST /api/channel-messages/{messageId}/reactions", r.auth(http.HandlerFunc(r.reactChannelMessage)))

	mux.Handle("GET /servers", r.auth(http.HandlerFunc(r.listServers)))
	mux.Handle("POST /servers", r.auth(http.HandlerFunc(r.createServer)))
	mux.Handle("POST /servers/join", r.auth(http.HandlerFunc(r.joinServerByInvite)))
	mux.Handle("GET /servers/{id}", r.auth(http.HandlerFunc(r.getServer)))
	mux.Handle("PATCH /servers/{id}", r.auth(http.HandlerFunc(r.updateServer)))
	mux.Handle("DELETE /servers/{id}", r.auth(http.HandlerFunc(r.deleteServer)))
	mux.Handle("POST /servers/{id}/join", r.auth(http.HandlerFunc(r.joinServer)))
	mux.Handle("POST /servers/{id}/leave", r.auth(http.HandlerFunc(r.leaveServer)))
	mux.Handle("GET /servers/{id}/invites", r.auth(http.HandlerFunc(r.listInvites)))
	mux.Handle("POST /servers/{id}/invites", r.auth(http.HandlerFunc(r.createInvite)))
	mux.Handle("GET /servers/{id}/members", r.auth(http.HandlerFunc(r.listMembers)))
	mux.Handle("GET /servers/{id}/channels/{channelId}/messages", r.auth(http.HandlerFunc(r.listChannelMessages)))
	mux.Handle("POST /servers/{id}/channels/{channelId}/messages", r.auth(http.HandlerFunc(r.createChannelMessage)))

	// Voice channel (REST + WebSocket signaling)
	mux.Handle("POST /api/voice/{channelId}/join", r.auth(http.HandlerFunc(r.voiceJoin)))
	mux.Handle("POST /api/voice/{channelId}/leave", r.auth(http.HandlerFunc(r.voiceLeave)))
	mux.Handle("GET /api/voice/{channelId}/participants", r.auth(http.HandlerFunc(r.voiceParticipants)))
	mux.Handle("GET /api/ws/voice", http.HandlerFunc(r.voiceWS))
	mux.Handle("GET /api/voice/health", r.auth(http.HandlerFunc(r.voiceHealth)))
	mux.Handle("POST /voice/{channelId}/join", r.auth(http.HandlerFunc(r.voiceJoin)))
	mux.Handle("POST /voice/{channelId}/leave", r.auth(http.HandlerFunc(r.voiceLeave)))
	mux.Handle("GET /voice/{channelId}/participants", r.auth(http.HandlerFunc(r.voiceParticipants)))
	mux.Handle("GET /ws/voice", http.HandlerFunc(r.voiceWS))

	// Profile
	mux.Handle("GET /api/me/profile", r.auth(http.HandlerFunc(r.getMyProfile)))
	mux.Handle("PATCH /api/me/profile", r.auth(http.HandlerFunc(r.updateMyProfile)))
	mux.Handle("GET /api/users/{id}/profile", r.auth(http.HandlerFunc(r.getPublicProfile)))
	mux.Handle("DELETE /api/friends/request/{id}", r.auth(http.HandlerFunc(r.cancelFriendRequest)))

	// Direct messages
	mux.Handle("GET /api/conversations", r.auth(http.HandlerFunc(r.listConversations)))
	mux.Handle("POST /api/conversations", r.auth(http.HandlerFunc(r.createConversation)))
	mux.Handle("GET /api/conversations/{id}", r.auth(http.HandlerFunc(r.getConversation)))
	mux.Handle("GET /api/conversations/{id}/messages", r.auth(http.HandlerFunc(r.listDMMessages)))
	mux.Handle("POST /api/conversations/{id}/messages", r.auth(http.HandlerFunc(r.createDMMessage)))
	mux.Handle("POST /api/conversations/{id}/read", r.auth(http.HandlerFunc(r.markDMRead)))
	mux.Handle("GET /api/conversations/{id}/search", r.auth(http.HandlerFunc(r.searchDMMessages)))
	mux.Handle("PATCH /api/messages/{id}", r.auth(http.HandlerFunc(r.updateDMMessage)))
	mux.Handle("DELETE /api/messages/{id}", r.auth(http.HandlerFunc(r.deleteDMMessage)))
	mux.Handle("POST /api/messages/{id}/reactions", r.auth(http.HandlerFunc(r.reactDMMessage)))
	mux.Handle("POST /api/users/{id}/block", r.auth(http.HandlerFunc(r.blockUser)))
	mux.Handle("DELETE /api/users/{id}/block", r.auth(http.HandlerFunc(r.unblockUser)))
	mux.Handle("GET /api/users/blocked", r.auth(http.HandlerFunc(r.listBlocked)))
	mux.Handle("GET /api/ws", http.HandlerFunc(r.realtimeWS))
	mux.Handle("GET /api/notifications", r.auth(http.HandlerFunc(r.listNotifications)))
	mux.Handle("POST /api/notifications/read-all", r.auth(http.HandlerFunc(r.markAllNotificationsRead)))
	mux.Handle("POST /api/notifications/{id}/read", r.auth(http.HandlerFunc(r.markNotificationRead)))
	mux.Handle("GET /api/presence/online", r.auth(http.HandlerFunc(r.onlineUsers)))

	return r.cors(logging(mux))
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		log.Printf("%s %s", req.Method, req.URL.Path)
		next.ServeHTTP(w, req)
	})
}

func (r *Router) cors(next http.Handler) http.Handler {
	allowed := parseOrigins(r.frontendOrigin)
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		origin := strings.TrimRight(strings.TrimSpace(req.Header.Get("Origin")), "/")
		if origin != "" {
			if _, ok := allowed["*"]; ok {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else {
				if req.Method == http.MethodOptions {
					writeError(w, http.StatusForbidden, "origin not allowed")
					return
				}
				writeError(w, http.StatusForbidden, "origin not allowed")
				return
			}
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Max-Age", "600")
		w.Header().Set("Vary", "Origin")
		if req.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, req)
	})
}

func parseOrigins(raw string) map[string]struct{} {
	allowed := make(map[string]struct{})
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimRight(strings.TrimSpace(part), "/")
		if part != "" {
			allowed[part] = struct{}{}
		}
	}
	if len(allowed) == 0 {
		allowed["http://localhost:5173"] = struct{}{}
	}
	return allowed
}

func (r *Router) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		raw, err := appauth.Bearer(req.Header.Get("Authorization"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		claims, err := r.tokens.Verify(raw)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		ctx := context.WithValue(req.Context(), userIDKey, claims.Subject)
		next.ServeHTTP(w, req.WithContext(ctx))
	})
}

func currentUserID(req *http.Request) string {
	id, _ := req.Context().Value(userIDKey).(string)
	return id
}

func (r *Router) health(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "webcall-api"})
}

var usernameRE = regexp.MustCompile(`^[A-Za-z0-9_.-]{3,24}$`)

func (r *Router) register(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Username    string `json:"username"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if !usernameRE.MatchString(in.Username) {
		writeError(w, http.StatusBadRequest, "username must be 3-24 characters: letters, numbers, _, ., -")
		return
	}
	if !strings.Contains(in.Email, "@") || len(in.Email) > 120 {
		writeError(w, http.StatusBadRequest, "valid email is required")
		return
	}
	if len(in.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if in.DisplayName == "" {
		in.DisplayName = in.Username
	}
	hash, salt, err := appauth.HashPassword(in.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to secure password")
		return
	}
	user := &store.User{
		Username:     in.Username,
		Email:        in.Email,
		DisplayName:  in.DisplayName,
		PasswordHash: hash,
		PasswordSalt: salt,
	}
	if err := r.store.CreateUser(user); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	token, err := r.tokens.Sign(user.ID, user.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": publicUser(user)})
}

func (r *Router) login(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	user := r.store.GetByLogin(strings.TrimSpace(in.Login))
	log.Printf("LOGIN ATTEMPT: %s", in.Login)

	if user == nil {
		log.Printf("USER NOT FOUND")
		writeError(w, http.StatusUnauthorized, "invalid username/email or password")
		return
	}

	log.Printf("USER FOUND: username=%s email=%s", user.Username, user.Email)

	ok := appauth.VerifyPassword(
		in.Password,
		user.PasswordHash,
		user.PasswordSalt,
	)

	log.Printf("PASSWORD MATCH: %v", ok)

	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid username/email or password")
		return
	}
	token, err := r.tokens.Sign(user.ID, user.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": publicUser(user)})
}

func (r *Router) me(w http.ResponseWriter, req *http.Request) {
	user := r.store.GetByID(currentUserID(req))
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": map[string]any{
		"id":            user.ID,
		"username":      user.Username,
		"email":         user.Email,
		"display_name":  user.DisplayName,
		"avatar_url":    user.AvatarURL,
		"banner_url":    user.BannerURL,
		"bio":           user.Bio,
		"custom_status": user.CustomStatus,
		"peer_id":       user.PeerID,
	}})
}

func (r *Router) peer(w http.ResponseWriter, req *http.Request) {
	if req.Method == http.MethodDelete {
		if err := r.store.ClearPeerID(currentUserID(req)); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	var in struct {
		PeerID string `json:"peer_id"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	if len(strings.TrimSpace(in.PeerID)) > 128 {
		writeError(w, http.StatusBadRequest, "peer id is too long")
		return
	}
	if err := r.store.SetPeerID(currentUserID(req), in.PeerID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) users(w http.ResponseWriter, req *http.Request) {
	q := req.URL.Query().Get("q")
	writeJSON(w, http.StatusOK, map[string]any{"users": r.store.SearchUsers(q, currentUserID(req))})
}

func (r *Router) friends(w http.ResponseWriter, req *http.Request) {
	user := r.store.GetByID(currentUserID(req))
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"friends": r.store.PublicByIDs(user.Friends)})
}

func (r *Router) requests(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"requests": r.store.Requests(currentUserID(req))})
}

func (r *Router) requestFriend(w http.ResponseWriter, req *http.Request) {
	var in struct {
		UserID string `json:"user_id"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	if err := r.store.RequestFriend(currentUserID(req), in.UserID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
}

func (r *Router) acceptFriend(w http.ResponseWriter, req *http.Request) {
	var in struct {
		UserID string `json:"user_id"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	if err := r.store.AcceptFriend(currentUserID(req), in.UserID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) rejectFriend(w http.ResponseWriter, req *http.Request) {
	var in struct {
		UserID string `json:"user_id"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	if err := r.store.RejectFriend(currentUserID(req), in.UserID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) removeFriend(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/friends/")
	if id == "" {
		writeError(w, http.StatusBadRequest, "friend user id is required")
		return
	}
	if err := r.store.RemoveFriend(currentUserID(req), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func publicUser(u *store.User) store.PublicUser {
	// Use store helper logic via PublicByIDs pattern — inline online check
	online := u.PeerID != "" && !u.LastSeen.IsZero() && time.Since(u.LastSeen) <= 90*time.Second
	peerID := ""
	if online {
		peerID = u.PeerID
	}
	return store.PublicUser{ID: u.ID, Username: u.Username, DisplayName: u.DisplayName, PeerID: peerID, LastSeen: u.LastSeen, Online: online}
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst any) bool {
	req.Body = http.MaxBytesReader(w, req.Body, 8<<10)
	defer req.Body.Close()
	dec := json.NewDecoder(req.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write response: %v", err)
	}
}
