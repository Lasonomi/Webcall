package httpapi

import (
	"net/http"
	"strings"

	appauth "webcall/backend/internal/auth"
)

func (r *Router) listConversations(w http.ResponseWriter, req *http.Request) {
	list, err := r.store.ListConversations(currentUserID(req))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": list})
}

func (r *Router) createConversation(w http.ResponseWriter, req *http.Request) {
	var in struct {
		UserID    string   `json:"user_id"`
		MemberIDs []string `json:"member_ids"`
		Name      string   `json:"name"`
		Type      string   `json:"type"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	if in.Type == "group" || len(in.MemberIDs) > 0 {
		conv, err := r.store.CreateGroupConversation(currentUserID(req), in.MemberIDs, in.Name)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"conversation": conv})
		return
	}
	conv, err := r.store.GetOrCreateDM(currentUserID(req), in.UserID)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "blocked") {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conv})
}

func (r *Router) getConversation(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	conv, err := r.store.GetConversation(id, currentUserID(req))
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "access denied") {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conv})
}

func (r *Router) listDMMessages(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	msgs, err := r.store.ListDMMessages(id, currentUserID(req), 100)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "access denied") {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	// mark read
	_ = r.store.MarkConversationRead(id, currentUserID(req))
	// notify peer of read
	if r.rt != nil {
		members := r.store.ConversationMemberIDs(id)
		r.rt.Publish(members, map[string]any{
			"type":            "dm:read",
			"conversation_id": id,
			"user_id":         currentUserID(req),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": msgs})
}

func (r *Router) createDMMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		Content        string `json:"content"`
		ReplyToID      string `json:"reply_to_id"`
		AttachmentURL  string `json:"attachment_url"`
		AttachmentType string `json:"attachment_type"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	msg, err := r.store.CreateDMMessage(id, currentUserID(req), in.Content, in.ReplyToID, in.AttachmentURL, in.AttachmentType)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "access denied") || strings.Contains(err.Error(), "blocked") {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	members := r.store.ConversationMemberIDs(id)
	if r.rt != nil {
		for _, mid := range members {
			if mid == currentUserID(req) {
				continue
			}
			if n, errN := r.store.CreateNotification(mid, "dm", "New message", "You have a new direct message", "conversation", id); errN == nil {
				r.rt.Publish([]string{mid}, map[string]any{"type": "notification:new", "notification": n})
			}
		}
		r.rt.Publish(members, map[string]any{
			"type":            "dm:message",
			"conversation_id": id,
			"message":         msg,
		})
	}
	writeJSON(w, http.StatusCreated, map[string]any{"message": msg})
}

func (r *Router) updateDMMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		Content string `json:"content"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	msg, err := r.store.UpdateDMMessage(id, currentUserID(req), in.Content)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if r.rt != nil {
		members := r.store.ConversationMemberIDs(msg.ConversationID)
		r.rt.Publish(members, map[string]any{
			"type":            "dm:update",
			"conversation_id": msg.ConversationID,
			"message":         msg,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

func (r *Router) deleteDMMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	err := r.store.DeleteDMMessage(id, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if r.rt != nil {
		r.rt.Publish([]string{currentUserID(req)}, map[string]any{
			"type":       "dm:delete",
			"message_id": id,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message_id": id})
}

func (r *Router) reactDMMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	var in struct {
		Emoji string `json:"emoji"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	reactions, err := r.store.ToggleReaction(id, currentUserID(req), in.Emoji)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if r.rt != nil {
		r.rt.Publish([]string{currentUserID(req)}, map[string]any{
			"type":       "dm:reaction",
			"message_id": id,
			"reactions":  reactions,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"reactions": reactions, "message_id": id})
}

func (r *Router) searchDMMessages(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	q := req.URL.Query().Get("q")
	msgs, err := r.store.SearchDMMessages(id, currentUserID(req), q)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": msgs})
}

func (r *Router) markDMRead(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.store.MarkConversationRead(id, currentUserID(req)); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if r.rt != nil {
		members := r.store.ConversationMemberIDs(id)
		r.rt.Publish(members, map[string]any{
			"type":            "dm:read",
			"conversation_id": id,
			"user_id":         currentUserID(req),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) blockUser(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.store.BlockUser(currentUserID(req), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) unblockUser(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.store.UnblockUser(currentUserID(req), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) listBlocked(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"blocked": r.store.ListBlocked(currentUserID(req))})
}

// GET /api/ws — general realtime (DM)
func (r *Router) realtimeWS(w http.ResponseWriter, req *http.Request) {
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
	if r.rt == nil {
		writeError(w, http.StatusServiceUnavailable, "realtime unavailable")
		return
	}
	r.rt.ServeWS(w, req, claims.Subject)
}
