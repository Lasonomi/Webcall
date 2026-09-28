package httpapi

import (
	"net/http"
)

func (r *Router) listNotifications(w http.ResponseWriter, req *http.Request) {
	list, err := r.store.ListNotifications(currentUserID(req), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	unread, _ := r.store.UnreadNotificationCount(currentUserID(req))
	writeJSON(w, http.StatusOK, map[string]any{"notifications": list, "unread": unread})
}

func (r *Router) markNotificationRead(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.store.MarkNotificationRead(currentUserID(req), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) markAllNotificationsRead(w http.ResponseWriter, req *http.Request) {
	if err := r.store.MarkAllNotificationsRead(currentUserID(req)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (r *Router) onlineUsers(w http.ResponseWriter, req *http.Request) {
	if r.rt == nil {
		writeJSON(w, http.StatusOK, map[string]any{"online": []string{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"online": r.rt.OnlineUserIDs()})
}
