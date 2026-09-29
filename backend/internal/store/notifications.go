package store

import (
	"errors"
	"time"
)

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body,omitempty"`
	RefType   string    `json:"ref_type,omitempty"`
	RefID     string    `json:"ref_id,omitempty"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) ensureNotifications() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  ref_type VARCHAR(40) NULL,
  ref_id VARCHAR(64) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
	return err
}

func (s *Store) CreateNotification(userID, typ, title, body, refType, refID string) (*Notification, error) {
	if err := s.ensureNotifications(); err != nil {
		return nil, err
	}
	id := newID()
	now := time.Now().UTC()
	_, err := s.db.Exec(`
INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id, is_read, created_at)
VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), 0, ?)`,
		id, userID, typ, title, body, refType, refID, now)
	if err != nil {
		return nil, err
	}
	return &Notification{
		ID: id, UserID: userID, Type: typ, Title: title, Body: body,
		RefType: refType, RefID: refID, Read: false, CreatedAt: now,
	}, nil
}

func (s *Store) ListNotifications(userID string, limit int) ([]Notification, error) {
	if err := s.ensureNotifications(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(`
SELECT id, user_id, type, title, COALESCE(body,''), COALESCE(ref_type,''), COALESCE(ref_id,''), is_read, created_at
FROM notifications WHERE user_id = ?
ORDER BY created_at DESC LIMIT ?`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Notification, 0)
	for rows.Next() {
		var n Notification
		var readInt int
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.RefType, &n.RefID, &readInt, &n.CreatedAt); err == nil {
			n.Read = readInt == 1
			out = append(out, n)
		}
	}
	return out, nil
}

func (s *Store) UnreadNotificationCount(userID string) (int, error) {
	if err := s.ensureNotifications(); err != nil {
		return 0, err
	}
	var n int
	err := s.db.QueryRow(`SELECT COUNT(1) FROM notifications WHERE user_id = ? AND is_read = 0`, userID).Scan(&n)
	return n, err
}

func (s *Store) MarkNotificationRead(userID, id string) error {
	res, err := s.db.Exec(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return err
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return errors.New("notification not found")
	}
	return nil
}

func (s *Store) MarkAllNotificationsRead(userID string) error {
	_, err := s.db.Exec(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, userID)
	return err
}

// Notifications use the realtime presence hub; no separate users.online flag is required.
