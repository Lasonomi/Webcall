package httpapi

import (
	"net/http"
	"strings"
)

func (r *Router) getMyProfile(w http.ResponseWriter, req *http.Request) {
	p, err := r.store.GetMyProfile(currentUserID(req))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": p})
}

func (r *Router) updateMyProfile(w http.ResponseWriter, req *http.Request) {
	var in map[string]string
	if !decodeJSON(w, req, &in) {
		return
	}
	p, err := r.store.UpdateMyProfile(currentUserID(req), in)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": p})
}

func (r *Router) getPublicProfile(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "user id required")
		return
	}
	p, err := r.store.GetPublicProfile(currentUserID(req), id)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		} else if strings.Contains(err.Error(), "private") {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profile": p})
}

func (r *Router) cancelFriendRequest(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.store.CancelFriendRequest(currentUserID(req), id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
