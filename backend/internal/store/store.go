package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type User struct {
	ID                   string    `json:"id"`
	Username             string    `json:"username"`
	Email                string    `json:"email"`
	DisplayName          string    `json:"display_name"`
	PasswordHash         string    `json:"password_hash"`
	PasswordSalt         string    `json:"password_salt"`
	PeerID               string    `json:"peer_id,omitempty"`
	LastSeen             time.Time `json:"last_seen,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	Friends              []string  `json:"friends"`
	IncomingRequests     []string  `json:"incoming_requests"`
	OutgoingRequests     []string  `json:"outgoing_requests"`
	AvatarURL            string    `json:"avatar_url,omitempty"`
	BannerURL            string    `json:"banner_url,omitempty"`
	Bio                  string    `json:"bio,omitempty"`
	CustomStatus         string    `json:"custom_status,omitempty"`
	PrivacyFriendRequest string    `json:"-"`
	PrivacyDM            string    `json:"-"`
	PrivacyProfile       string    `json:"-"`
}

type PublicUser struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	PeerID       string    `json:"peer_id,omitempty"`
	LastSeen     time.Time `json:"last_seen,omitempty"`
	Online       bool      `json:"online"`
	CustomStatus string    `json:"custom_status,omitempty"`
}

const presenceTTL = 90 * time.Second

type Store struct {
	mu sync.RWMutex
	db *sql.DB
}

func New(dsn string) (*Store, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("mysql ping: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := s.migrateUnifiedMessages(); err != nil {
		// non-fatal soft migrate
		_ = err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(191) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  peer_id VARCHAR(128) NOT NULL DEFAULT '',
  last_seen DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS friendships (
  user_id VARCHAR(64) NOT NULL,
  friend_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  KEY idx_friendships_friend (friend_id),
  CONSTRAINT fk_friendships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS friend_requests (
  from_id VARCHAR(64) NOT NULL,
  to_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (from_id, to_id),
  KEY idx_requests_to (to_id),
  CONSTRAINT fk_requests_from FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_requests_to FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	if err := s.migrateServers(); err != nil {
		return err
	}
	if err := s.migrateDM(); err != nil {
		return err
	}
	if err := s.migrateProfile(); err != nil {
		return err
	}
	if err := s.migrateUnifiedMessages(); err != nil {
		return err
	}
	return nil
}

var idCounter uint64

func NewIDPublic() string { return newID() }

func newID() string {
	// Timestamp + atomic counter + random bytes → collision-safe even in tight loops
	n := atomic.AddUint64(&idCounter, 1)
	var b [4]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%d%06d%s", time.Now().UnixMilli(), n%1e6, hex.EncodeToString(b[:]))
}

func (s *Store) CreateUser(user *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if user.ID == "" {
		user.ID = newID()
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now().UTC()
	}

	_, err := s.db.Exec(`
INSERT INTO users (id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at)
VALUES (?, ?, ?, ?, ?, ?, '', NULL, ?)`,
		user.ID, user.Username, user.Email, user.DisplayName, user.PasswordHash, user.PasswordSalt, user.CreatedAt.UTC(),
	)
	if err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "duplicate") && strings.Contains(msg, "username") {
			return errors.New("username already exists")
		}
		if strings.Contains(msg, "duplicate") && strings.Contains(msg, "email") {
			return errors.New("email already exists")
		}
		if strings.Contains(msg, "duplicate") {
			return errors.New("username or email already exists")
		}
		return err
	}
	user.Friends = []string{}
	user.IncomingRequests = []string{}
	user.OutgoingRequests = []string{}
	return nil
}

func (s *Store) scanUser(row interface{ Scan(dest ...any) error }) (*User, error) {
	var u User
	var lastSeen sql.NullTime
	err := row.Scan(&u.ID, &u.Username, &u.Email, &u.DisplayName, &u.PasswordHash, &u.PasswordSalt, &u.PeerID, &lastSeen, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	if lastSeen.Valid {
		u.LastSeen = lastSeen.Time
	}
	return &u, nil
}


func (s *Store) GetByID(id string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, err := s.getByIDLocked(id)
	if err != nil || u == nil {
		return nil
	}
	s.fillRelationsLocked(u)
	return u
}

func (s *Store) GetByLogin(login string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	row := s.db.QueryRow(userSelectExtended+` WHERE username = ? OR email = ?`, login, login)
	u, err := s.scanUserProfile(row)
	if err != nil {
		row2 := s.db.QueryRow(`
SELECT id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at
FROM users WHERE username = ? OR email = ?`, login, login)
		u, err = s.scanUser(row2)
	}
	if err != nil || u == nil {
		return nil
	}
	s.fillRelationsLocked(u)
	return u
}

func (s *Store) fillRelationsLocked(u *User) {
	u.Friends = s.listIDs(`SELECT friend_id FROM friendships WHERE user_id = ?`, u.ID)
	u.IncomingRequests = s.listIDs(`SELECT from_id FROM friend_requests WHERE to_id = ?`, u.ID)
	u.OutgoingRequests = s.listIDs(`SELECT to_id FROM friend_requests WHERE from_id = ?`, u.ID)
}

func (s *Store) listIDs(query string, arg string) []string {
	rows, err := s.db.Query(query, arg)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out
}

func (s *Store) SearchUsers(query string, excludeID string) []PublicUser {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query = strings.TrimSpace(query)
	var rows *sql.Rows
	var err error
	if query == "" {
		rows, err = s.db.Query(`
SELECT id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at
FROM users WHERE id != ? ORDER BY username LIMIT 20`, excludeID)
	} else {
		like := "%" + query + "%"
		rows, err = s.db.Query(`
SELECT id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at
FROM users
WHERE id != ? AND (username LIKE ? OR display_name LIKE ?)
ORDER BY username LIMIT 20`, excludeID, like, like)
	}
	if err != nil {
		return nil
	}
	defer rows.Close()

	result := make([]PublicUser, 0)
	for rows.Next() {
		u, err := s.scanUser(rows)
		if err != nil {
			continue
		}
		result = append(result, public(u))
	}
	return result
}

func (s *Store) SetPeerID(userID, peerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	peerID = strings.TrimSpace(peerID)
	var res sql.Result
	var err error
	if peerID == "" {
		res, err = s.db.Exec(`UPDATE users SET peer_id = '', last_seen = NULL WHERE id = ?`, userID)
	} else {
		res, err = s.db.Exec(`UPDATE users SET peer_id = ?, last_seen = ? WHERE id = ?`, peerID, time.Now().UTC(), userID)
	}
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (s *Store) ClearPeerID(userID string) error {
	return s.SetPeerID(userID, "")
}

func (s *Store) UpdateDisplayName(userID, displayName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, err := s.db.Exec(`UPDATE users SET display_name = ? WHERE id = ?`, strings.TrimSpace(displayName), userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (s *Store) RequestFriend(fromID, targetID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if fromID == targetID {
		return errors.New("cannot add yourself")
	}
	from, err := s.getByIDLocked(fromID)
	target, err2 := s.getByIDLocked(targetID)
	if err != nil || err2 != nil || from == nil || target == nil {
		return errors.New("user not found")
	}
	if err := s.canSendFriendRequest(fromID, targetID, target); err != nil {
		return err
	}

	_, err = s.db.Exec(`INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)`,
		fromID, targetID, time.Now().UTC())
	return err
}

func (s *Store) AcceptFriend(userID, requesterID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var exists int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM friend_requests WHERE from_id = ? AND to_id = ?`, requesterID, userID).Scan(&exists)
	if exists == 0 {
		return errors.New("friend request not found")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?`, requesterID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?`, userID, requesterID); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)`, userID, requesterID); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)`, requesterID, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) RejectFriend(userID, requesterID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec(`DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?`, requesterID, userID)
	return err
}

func (s *Store) RemoveFriend(userID, friendID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM friendships WHERE user_id = ? AND friend_id = ?`, userID, friendID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM friendships WHERE user_id = ? AND friend_id = ?`, friendID, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) PublicByIDs(ids []string) []PublicUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]PublicUser, 0, len(ids))
	for _, id := range ids {
		u, err := s.getByIDLocked(id)
		if err != nil || u == nil {
			continue
		}
		result = append(result, public(u))
	}
	return result
}

func (s *Store) Requests(userID string) []PublicUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ids := s.listIDs(`SELECT from_id FROM friend_requests WHERE to_id = ?`, userID)
	result := make([]PublicUser, 0, len(ids))
	for _, id := range ids {
		u, err := s.getByIDLocked(id)
		if err != nil || u == nil {
			continue
		}
		result = append(result, public(u))
	}
	return result
}

func public(u *User) PublicUser {
	online := u.PeerID != "" && !u.LastSeen.IsZero() && time.Since(u.LastSeen) <= presenceTTL
	peerID := ""
	if online {
		peerID = u.PeerID
	}
	return PublicUser{
		ID:           u.ID,
		Username:     u.Username,
		DisplayName:  u.DisplayName,
		AvatarURL:    u.AvatarURL,
		PeerID:       peerID,
		LastSeen:     u.LastSeen,
		Online:       online,
		CustomStatus: u.CustomStatus,
	}
}
