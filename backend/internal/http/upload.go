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

const maxUploadBytes = 15 << 20 // 15 MB

var allowedExt = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".heic": "image/heic",
	".pdf":  "application/pdf",
	".txt":  "text/plain",
	".zip":  "application/zip",
	".rar":  "application/vnd.rar",
	".mp3":  "audio/mpeg",
	".wav":  "audio/wav",
	".ogg":  "audio/ogg",
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".mov":  "video/quicktime",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls":  "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

func (r *Router) uploadDir() string {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "uploads"
	}
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func (r *Router) uploadFile(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	req.Body = http.MaxBytesReader(w, req.Body, maxUploadBytes+1024)
	if err := req.ParseMultipartForm(maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 15MB) or invalid form: "+err.Error())
		return
	}
	file, header, err := req.FormFile("file")
	if err != nil {
		// try alternate field names
		file, header, err = req.FormFile("image")
		if err != nil {
			writeError(w, http.StatusBadRequest, "file field is required (form field name: file)")
			return
		}
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	mime, ok := allowedExt[ext]
	if !ok {
		// fallback: sniff content-type from header
		ct := strings.ToLower(header.Header.Get("Content-Type"))
		switch {
		case strings.HasPrefix(ct, "image/"):
			mime = ct
			if ext == "" {
				ext = ".img"
			}
			ok = true
		case strings.HasPrefix(ct, "video/"):
			mime = ct
			if ext == "" {
				ext = ".vid"
			}
			ok = true
		case strings.HasPrefix(ct, "audio/"):
			mime = ct
			if ext == "" {
				ext = ".aud"
			}
			ok = true
		case ct == "application/pdf":
			mime = ct
			if ext == "" {
				ext = ".pdf"
			}
			ok = true
		}
	}
	if !ok {
		writeError(w, http.StatusBadRequest, "file type not allowed: "+ext+" (use images, pdf, docs, audio, video, zip)")
		return
	}

	id := store.NewIDPublic()
	name := id + ext
	destPath := filepath.Join(r.uploadDir(), name)

	out, err := os.Create(destPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file: "+err.Error())
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
		writeError(w, http.StatusBadRequest, "file too large (max 15MB)")
		return
	}
	if written == 0 {
		_ = os.Remove(destPath)
		writeError(w, http.StatusBadRequest, "empty file")
		return
	}

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

func (r *Router) serveUpload(w http.ResponseWriter, req *http.Request) {
	name := req.PathValue("file")
	if name == "" {
		name = strings.TrimPrefix(req.URL.Path, "/uploads/")
	}
	name = filepath.Base(name)
	if name == "." || name == "/" || name == "" {
		http.NotFound(w, req)
		return
	}
	path := filepath.Join(r.uploadDir(), name)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, req)
		return
	}
	// CORS for <img> from frontend origin
	origin := req.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, req, path)
}
