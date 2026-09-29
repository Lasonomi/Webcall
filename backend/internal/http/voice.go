package httpapi

import (
	"net/http"
	"strings"

	appauth "webcall/backend/internal/auth"
)

// POST /api/voice/{channelId}/join — verify membership, return room info + current participants
func (r *Router) voiceJoin(w http.ResponseWriter, req *http.Request) {
	channelID := req.PathValue("channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel id is required")
		return
	}
	userID := currentUserID(req)
	serverID, name, role, err := r.store.GetVoiceChannel(channelID, userID)
	if err != nil {
		status := http.StatusBadRequest
		msg := err.Error()
		if strings.Contains(msg, "access denied") {
			status = http.StatusForbidden
		} else if strings.Contains(msg, "channel not found") {
			status = http.StatusNotFound
		}
		writeError(w, status, msg)
		return
	}
	user := r.store.GetByID(userID)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "user not found")
		return
	}
	participants := []any{}
	if r.voice != nil {
		list := r.voice.ListChannel(channelID)
		for _, p := range list {
			participants = append(participants, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"channel_id":   channelID,
		"channel_name": name,
		"server_id":    serverID,
		"role":         role,
		"user": map[string]any{
			"id":           user.ID,
			"username":     user.Username,
			"display_name": user.DisplayName,
		},
		"participants": participants,
	})
}

// POST /api/voice/{channelId}/leave
func (r *Router) voiceLeave(w http.ResponseWriter, req *http.Request) {
	channelID := req.PathValue("channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel id is required")
		return
	}
	userID := currentUserID(req)
	if _, _, _, err := r.store.GetVoiceChannel(channelID, userID); err != nil {
		status := http.StatusBadRequest
		msg := err.Error()
		if strings.Contains(msg, "access denied") {
			status = http.StatusForbidden
		} else if strings.Contains(msg, "channel not found") {
			status = http.StatusNotFound
		}
		writeError(w, status, msg)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "channel_id": channelID})
}

// GET /api/voice/{channelId}/participants
func (r *Router) voiceParticipants(w http.ResponseWriter, req *http.Request) {
	channelID := req.PathValue("channelId")
	if channelID == "" {
		writeError(w, http.StatusBadRequest, "channel id is required")
		return
	}
	userID := currentUserID(req)
	if _, _, _, err := r.store.GetVoiceChannel(channelID, userID); err != nil {
		status := http.StatusBadRequest
		msg := err.Error()
		if strings.Contains(msg, "access denied") {
			status = http.StatusForbidden
		} else if strings.Contains(msg, "channel not found") {
			status = http.StatusNotFound
		}
		writeError(w, status, msg)
		return
	}
	participants := []any{}
	if r.voice != nil {
		list := r.voice.ListChannel(channelID)
		for _, p := range list {
			participants = append(participants, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"participants": participants})
}

// GET /api/ws/voice?token=JWT — WebSocket signaling for voice presence + mesh coordination
func (r *Router) voiceWS(w http.ResponseWriter, req *http.Request) {
	token := req.URL.Query().Get("token")
	if token == "" {
		raw, err := appauth.Bearer(req.Header.Get("Authorization"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		token = raw
	}
	claims, err := r.tokens.Verify(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}
	user := r.store.GetByID(claims.Subject)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "user not found")
		return
	}
	if r.voice == nil {
		writeError(w, http.StatusServiceUnavailable, "voice service unavailable")
		return
	}
	r.voice.ServeWS(w, req, user.ID, user.Username, user.DisplayName)
}

func (r *Router) voiceHealth(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"voice":   r.voice != nil,
		"service": "webcall-voice",
	})
}
