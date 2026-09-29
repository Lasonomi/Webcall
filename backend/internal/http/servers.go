package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
)

func decodeOptionalJSON(req *http.Request, dst any) error {
	if req.Body == nil {
		return nil
	}
	dec := json.NewDecoder(req.Body)
	_ = dec.Decode(dst)
	return nil
}

func (r *Router) createServer(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Name    string `json:"name"`
		IconURL string `json:"icon_url"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		writeError(w, http.StatusBadRequest, "server name is required")
		return
	}
	srv, err := r.store.CreateServer(currentUserID(req), in.Name, in.IconURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"server": srv})
}

func (r *Router) listServers(w http.ResponseWriter, req *http.Request) {
	list, err := r.store.ListUserServers(currentUserID(req))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"servers": list})
}

func (r *Router) getServer(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	srv, channels, role, err := r.store.GetServer(id, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"server":   srv,
		"channels": channels,
		"role":     role,
	})
}

func (r *Router) updateServer(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	var in struct {
		Name    string `json:"name"`
		IconURL string `json:"icon_url"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	srv, err := r.store.UpdateServer(id, currentUserID(req), in.Name, in.IconURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": srv})
}

func (r *Router) deleteServer(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	if err := r.store.DeleteServer(id, currentUserID(req)); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) joinServer(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	srv, err := r.store.JoinServer(id, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": srv})
}

func (r *Router) joinServerByInvite(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Code string `json:"code"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	srv, err := r.store.JoinServerByInvite(in.Code, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"server": srv})
}

func (r *Router) leaveServer(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	if err := r.store.LeaveServer(id, currentUserID(req)); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) createInvite(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	var in struct {
		MaxUses int `json:"max_uses"`
	}
	_ = decodeOptionalJSON(req, &in)

	invite, err := r.store.CreateInvite(id, currentUserID(req), in.MaxUses)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"invite": invite})
}

func (r *Router) listInvites(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	invites, err := r.store.ListInvites(id, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invites": invites})
}

func (r *Router) listMembers(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "server id is required")
		return
	}
	members, err := r.store.ListServerMembers(id, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"members": members})
}

func (r *Router) listChannelMessages(w http.ResponseWriter, req *http.Request) {
	serverID := req.PathValue("id")
	channelID := req.PathValue("channelId")
	if serverID == "" || channelID == "" {
		writeError(w, http.StatusBadRequest, "server and channel id required")
		return
	}
	messages, err := r.store.ListChannelMessages(serverID, channelID, currentUserID(req))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": messages})
}

func (r *Router) createChannelMessage(w http.ResponseWriter, req *http.Request) {
	serverID := req.PathValue("id")
	channelID := req.PathValue("channelId")
	var in struct {
		Content        string `json:"content"`
		AttachmentURL  string `json:"attachment_url"`
		AttachmentType string `json:"attachment_type"`
		ReplyToID      string `json:"reply_to_id"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	msg, err := r.store.CreateChannelMessage(serverID, channelID, currentUserID(req), in.Content, in.AttachmentURL, in.AttachmentType, in.ReplyToID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"message": msg})
}

func (r *Router) updateChannelMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("messageId")
	var in struct {
		Content string `json:"content"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	msg, err := r.store.UpdateChannelMessage(id, currentUserID(req), in.Content)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

func (r *Router) deleteChannelMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("messageId")
	if err := r.store.DeleteChannelMessage(id, currentUserID(req)); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message_id": id})
}

func (r *Router) reactChannelMessage(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("messageId")
	var in struct {
		Emoji string `json:"emoji"`
	}
	if !decodeJSON(w, req, &in) {
		return
	}
	reactions, err := r.store.ToggleChannelReaction(id, currentUserID(req), in.Emoji)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reactions": reactions, "message_id": id})
}
