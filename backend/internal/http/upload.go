package httpapi

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"webcall/backend/internal/store"
)

const maxUploadBytes = 10 << 20 // 10 MB

var allowedExt = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".pdf":  "application/pdf",
	".txt":  "text/plain",
	".zip":  "application/zip",
	".mp3":  "audio/mpeg",
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

func (r *Router) uploadDir() string {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "uploads"
	}
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

// POST /api/upload  multipart field "file"
func (r *Router) uploadFile(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxUploadBytes+512)
	if err := req.ParseMultipartForm(maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 10MB) or invalid form")
		return
	}
	file, header, err := req.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file field is required")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	mime, ok := allowedExt[ext]
	if !ok {
		writeError(w, http.StatusBadRequest, "file type not allowed")
		return
	}

	// Optional content-type check from client
	if ct := header.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/octet-stream") {
		// soft check — still trust extension whitelist
	}

	id := store.NewIDPublic()
	name := id + ext
	dir := r.uploadDir()
	destPath := filepath.Join(dir, name)

	out, err := os.Create(destPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer out.Close()

	written, err := io.Copy(out, io.LimitReader(file, maxUploadBytes+1))
	if err != nil {
		_ = os.Remove(destPath)
		writeError(w, http.StatusInternalServerError, "failed to write file")
		return
	}
	if written > maxUploadBytes {
		_ = os.Remove(destPath)
		writeError(w, http.StatusBadRequest, "file too large (max 10MB)")
		return
	}

	// Public URL path
	urlPath := "/uploads/" + name
	writeJSON(w, http.StatusCreated, map[string]any{
		"url":        urlPath,
		"filename":   header.Filename,
		"size":       written,
		"mime_type":  mime,
		"type":       mimeCategory(mime),
		"created_at": time.Now().UTC(),
	})
}

func mimeCategory(mime string) string {
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	default:
		return "file"
	}
}

// Safe static file server for /uploads/*
func (r *Router) serveUpload(w http.ResponseWriter, req *http.Request) {
	name := req.PathValue("file")
	if name == "" {
		name = strings.TrimPrefix(req.URL.Path, "/uploads/")
	}
	name = filepath.Base(name) // prevent path traversal
	if name == "." || name == "/" || name == "" {
		http.NotFound(w, req)
		return
	}
	path := filepath.Join(r.uploadDir(), name)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, req)
		return
	}
	// Cache uploaded assets briefly
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, req, path)
}
