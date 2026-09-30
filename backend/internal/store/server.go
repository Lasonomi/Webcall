package store

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

type Server struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	IconURL     string    `json:"icon_url"`
	OwnerID     string    `json:"owner_id"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	MemberCount int       `json:"member_count,omitempty"`
	UserRole    string    `json:"user_role,omitempty"`
}

type ServerMember struct {
	ServerID    string    `json:"server_id"`
	UserID      string    `json:"user_id"`
	Role        string    `json:"role"` // OWNER, ADMIN, MEMBER
	JoinedAt    time.Time `json:"joined_at"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	PeerID      string    `json:"peer_id,omitempty"`
	LastSeen    time.Time `json:"last_seen,omitempty"`
	Online      bool      `json:"online"`
}

type ServerInvite struct {
	Code      string     `json:"code"`
	ServerID  string     `json:"server_id"`
	CreatedBy string     `json:"created_by"`
	MaxUses   int        `json:"max_uses"`
	Uses      int        `json:"uses"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Channel struct {
	ID           string    `json:"id"`
	ServerID     string    `json:"server_id"`
	Name         string    `json:"name"`
	Type         string    `json:"type"` // "text", "voice"
	Category     string    `json:"category"`
	Position     int       `json:"position"`
	AllowMessage bool      `json:"allow_message"`
	AllowUpload  bool      `json:"allow_upload"`
	AllowVoice   bool      `json:"allow_voice"`
	AllowVideo   bool      `json:"allow_video"`
	CreatedAt    time.Time `json:"created_at"`
}

type ChannelMessage struct {
	ID             string     `json:"id"`
	ServerID       string     `json:"server_id"`
	ChannelID      string     `json:"channel_id"`
	UserID         string     `json:"user_id"`
	Username       string     `json:"username"`
	DisplayName    string     `json:"display_name"`
	AvatarURL      string     `json:"avatar_url,omitempty"`
	Content        string     `json:"content"`
	AttachmentURL  string     `json:"attachment_url,omitempty"`
	AttachmentType string     `json:"attachment_type,omitempty"`
	ReplyToID      string     `json:"reply_to_id,omitempty"`
	ReplyPreview   string     `json:"reply_preview,omitempty"`
	UpdatedAt      *time.Time `json:"updated_at,omitempty"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
	Reactions      []struct {
		Emoji string `json:"emoji"`
		Count int    `json:"count"`
	} `json:"reactions,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) migrateServers() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS servers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon_url TEXT NULL,
  owner_id VARCHAR(64) NOT NULL,
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_servers_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS server_members (
  server_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  joined_at DATETIME(6) NOT NULL,
  PRIMARY KEY (server_id, user_id),
  KEY idx_sm_user (user_id),
  CONSTRAINT fk_sm_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  CONSTRAINT fk_sm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS server_invites (
  code VARCHAR(32) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  max_uses INT NOT NULL DEFAULT 0,
  uses INT NOT NULL DEFAULT 0,
  expires_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY idx_invites_server (server_id),
  CONSTRAINT fk_invites_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  CONSTRAINT fk_invites_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(64) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  category VARCHAR(64) NOT NULL DEFAULT 'TEXT CHANNELS',
  position INT NOT NULL DEFAULT 0,
  allow_message BOOLEAN NOT NULL DEFAULT TRUE,
  allow_upload BOOLEAN NOT NULL DEFAULT FALSE,
  allow_voice BOOLEAN NOT NULL DEFAULT FALSE,
  allow_video BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  KEY idx_channels_server (server_id),
  CONSTRAINT fk_channels_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS channel_messages (
  id VARCHAR(64) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  channel_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY idx_cm_channel (channel_id, created_at),
  CONSTRAINT fk_cm_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	for _, q := range []string{
		`ALTER TABLE channels ADD COLUMN allow_message BOOLEAN NOT NULL DEFAULT TRUE`,
		`ALTER TABLE channels ADD COLUMN allow_upload BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE channels ADD COLUMN allow_voice BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE channels ADD COLUMN allow_video BOOLEAN NOT NULL DEFAULT FALSE`,
	} {
		if _, err := s.db.Exec(q); err != nil {
			msg := strings.ToLower(err.Error())
			if !strings.Contains(msg, "duplicate column") && !strings.Contains(msg, "1060") && !strings.Contains(msg, "exists") {
				return err
			}
		}
	}
	_, _ = s.db.Exec(`UPDATE channels SET allow_voice = TRUE, allow_video = TRUE WHERE type = 'voice'`)
	return nil
}

func generateInviteCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 8)
	for i := range b {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return fmt.Sprintf("%08X", time.Now().UnixNano()%0xFFFFFFFF)
		}
		b[i] = chars[num.Int64()]
	}
	return string(b)
}

func (s *Store) CreateServer(ownerID, name, iconURL string) (*Server, error) {
	name = strings.TrimSpace(name)
	if len(name) < 2 {
		return nil, errors.New("server name must be at least 2 characters")
	}
	if len(name) > 100 {
		return nil, errors.New("server name cannot exceed 100 characters")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	owner, err := s.getByIDLocked(ownerID)
	if err != nil || owner == nil {
		return nil, errors.New("owner user not found")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	srvID := newID()
	now := time.Now().UTC()

	_, err = tx.Exec(`
INSERT INTO servers (id, name, icon_url, owner_id, description, created_at)
VALUES (?, ?, ?, ?, '', ?)`, srvID, name, strings.TrimSpace(iconURL), ownerID, now)
	if err != nil {
		return nil, err
	}

	// Owner member
	_, err = tx.Exec(`
INSERT INTO server_members (server_id, user_id, role, joined_at)
VALUES (?, ?, 'OWNER', ?)`, srvID, ownerID, now)
	if err != nil {
		return nil, err
	}

	// Default channels
	chanGeneralID := newID()
	chanAnnounceID := newID()
	chanLoungeID := newID()

	_, err = tx.Exec(`
INSERT INTO channels (id, server_id, name, type, category, position, allow_message, allow_upload, allow_voice, allow_video, created_at)
VALUES 
  (?, ?, 'general', 'text', 'TEXT CHANNELS', 0, TRUE, TRUE, FALSE, FALSE, ?),
  (?, ?, 'announcements', 'text', 'TEXT CHANNELS', 1, TRUE, FALSE, FALSE, FALSE, ?),
  (?, ?, 'Lounge', 'voice', 'VOICE CHANNELS', 2, FALSE, FALSE, TRUE, TRUE, ?)`,
		chanGeneralID, srvID, now,
		chanAnnounceID, srvID, now,
		chanLoungeID, srvID, now,
	)
	if err != nil {
		return nil, err
	}

	// Default invite
	inviteCode := generateInviteCode()
	_, err = tx.Exec(`
INSERT INTO server_invites (code, server_id, created_by, max_uses, uses, created_at)
VALUES (?, ?, ?, 0, 0, ?)`, inviteCode, srvID, ownerID, now)
	if err != nil {
		return nil, err
	}

	// Welcome message in #general
	welcomeMsgID := newID()
	_, _ = tx.Exec(`
INSERT INTO channel_messages (id, server_id, channel_id, user_id, content, created_at)
VALUES (?, ?, ?, ?, ?, ?)`,
		welcomeMsgID, srvID, chanGeneralID, ownerID,
		fmt.Sprintf("Welcome to %s! The community space has been created.", name), now,
	)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Server{
		ID:          srvID,
		Name:        name,
		IconURL:     iconURL,
		OwnerID:     ownerID,
		CreatedAt:   now,
		MemberCount: 1,
		UserRole:    "OWNER",
	}, nil
}

func (s *Store) ListUserServers(userID string) ([]Server, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query(`
SELECT s.id, s.name, COALESCE(s.icon_url, ''), s.owner_id, COALESCE(s.description, ''), s.created_at, sm.role,
  (SELECT COUNT(1) FROM server_members WHERE server_id = s.id) AS member_count
FROM servers s
JOIN server_members sm ON s.id = sm.server_id
WHERE sm.user_id = ?
ORDER BY sm.joined_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Server, 0)
	for rows.Next() {
		var srv Server
		if err := rows.Scan(&srv.ID, &srv.Name, &srv.IconURL, &srv.OwnerID, &srv.Description, &srv.CreatedAt, &srv.UserRole, &srv.MemberCount); err == nil {
			list = append(list, srv)
		}
	}
	return list, nil
}

func (s *Store) GetServer(serverID, userID string) (*Server, []Channel, string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Check member
	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return nil, nil, "", errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return nil, nil, "", err
	}

	var srv Server
	err = s.db.QueryRow(`
SELECT s.id, s.name, COALESCE(s.icon_url, ''), s.owner_id, COALESCE(s.description, ''), s.created_at,
  (SELECT COUNT(1) FROM server_members WHERE server_id = s.id) AS member_count
FROM servers s WHERE s.id = ?`, serverID).Scan(&srv.ID, &srv.Name, &srv.IconURL, &srv.OwnerID, &srv.Description, &srv.CreatedAt, &srv.MemberCount)
	if err != nil {
		return nil, nil, "", err
	}
	srv.UserRole = role

	// Channels
	cRows, err := s.db.Query(`
SELECT id, server_id, name, type, category, position, allow_message, allow_upload, allow_voice, allow_video, created_at
FROM channels WHERE server_id = ? ORDER BY position ASC, created_at ASC`, serverID)
	if err != nil {
		return nil, nil, "", err
	}
	defer cRows.Close()

	channels := make([]Channel, 0)
	for cRows.Next() {
		var ch Channel
		if err := cRows.Scan(&ch.ID, &ch.ServerID, &ch.Name, &ch.Type, &ch.Category, &ch.Position, &ch.AllowMessage, &ch.AllowUpload, &ch.AllowVoice, &ch.AllowVideo, &ch.CreatedAt); err == nil {
			channels = append(channels, ch)
		}
	}

	return &srv, channels, role, nil
}

func (s *Store) UpdateServer(serverID, userID, name, iconURL string) (*Server, error) {
	name = strings.TrimSpace(name)
	if len(name) < 2 {
		return nil, errors.New("server name must be at least 2 characters")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows || (role != "OWNER" && role != "ADMIN") {
		return nil, errors.New("unauthorized: only owner or admin can edit server settings")
	} else if err != nil {
		return nil, err
	}

	_, err = s.db.Exec(`UPDATE servers SET name = ?, icon_url = ? WHERE id = ?`, name, strings.TrimSpace(iconURL), serverID)
	if err != nil {
		return nil, err
	}

	var srv Server
	err = s.db.QueryRow(`
SELECT s.id, s.name, COALESCE(s.icon_url, ''), s.owner_id, COALESCE(s.description, ''), s.created_at,
  (SELECT COUNT(1) FROM server_members WHERE server_id = s.id) AS member_count
FROM servers s WHERE s.id = ?`, serverID).Scan(&srv.ID, &srv.Name, &srv.IconURL, &srv.OwnerID, &srv.Description, &srv.CreatedAt, &srv.MemberCount)
	if err != nil {
		return nil, err
	}
	srv.UserRole = role
	return &srv, nil
}

func (s *Store) DeleteServer(serverID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows || role != "OWNER" {
		return errors.New("unauthorized: only the server owner can delete this server")
	} else if err != nil {
		return err
	}

	_, err = s.db.Exec(`DELETE FROM servers WHERE id = ?`, serverID)
	return err
}

func (s *Store) JoinServer(serverID, userID string) (*Server, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var exists int
	err := s.db.QueryRow(`SELECT COUNT(1) FROM servers WHERE id = ?`, serverID).Scan(&exists)
	if err != nil || exists == 0 {
		return nil, errors.New("server not found")
	}

	var count int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&count)
	if count == 0 {
		_, err = s.db.Exec(`INSERT INTO server_members (server_id, user_id, role, joined_at) VALUES (?, ?, 'MEMBER', ?)`,
			serverID, userID, time.Now().UTC())
		if err != nil {
			return nil, err
		}
	}

	var srv Server
	err = s.db.QueryRow(`
SELECT s.id, s.name, COALESCE(s.icon_url, ''), s.owner_id, COALESCE(s.description, ''), s.created_at,
  (SELECT COUNT(1) FROM server_members WHERE server_id = s.id) AS member_count
FROM servers s WHERE s.id = ?`, serverID).Scan(&srv.ID, &srv.Name, &srv.IconURL, &srv.OwnerID, &srv.Description, &srv.CreatedAt, &srv.MemberCount)
	if err != nil {
		return nil, err
	}
	srv.UserRole = "MEMBER"
	return &srv, nil
}

func (s *Store) JoinServerByInvite(code, userID string) (*Server, error) {
	code = strings.TrimSpace(code)
	if strings.Contains(code, "/") {
		parts := strings.Split(code, "/")
		code = parts[len(parts)-1]
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New("invitation code is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var inv ServerInvite
	var expiresAt sql.NullTime
	err := s.db.QueryRow(`
SELECT code, server_id, created_by, max_uses, uses, expires_at, created_at
FROM server_invites WHERE code = ?`, code).Scan(&inv.Code, &inv.ServerID, &inv.CreatedBy, &inv.MaxUses, &inv.Uses, &expiresAt, &inv.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, errors.New("invalid or non-existent invitation code")
	} else if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		inv.ExpiresAt = &expiresAt.Time
		if time.Now().UTC().After(expiresAt.Time) {
			return nil, errors.New("invitation code has expired")
		}
	}
	if inv.MaxUses > 0 && inv.Uses >= inv.MaxUses {
		return nil, errors.New("invitation code has reached its maximum uses")
	}

	var currentRole string
	err = s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, inv.ServerID, userID).Scan(&currentRole)
	if err == sql.ErrNoRows {
		// Join as MEMBER
		_, err = s.db.Exec(`INSERT INTO server_members (server_id, user_id, role, joined_at) VALUES (?, ?, 'MEMBER', ?)`,
			inv.ServerID, userID, time.Now().UTC())
		if err != nil {
			return nil, err
		}
		_, _ = s.db.Exec(`UPDATE server_invites SET uses = uses + 1 WHERE code = ?`, code)
		currentRole = "MEMBER"
	}

	var srv Server
	err = s.db.QueryRow(`
SELECT s.id, s.name, COALESCE(s.icon_url, ''), s.owner_id, COALESCE(s.description, ''), s.created_at,
  (SELECT COUNT(1) FROM server_members WHERE server_id = s.id) AS member_count
FROM servers s WHERE s.id = ?`, inv.ServerID).Scan(&srv.ID, &srv.Name, &srv.IconURL, &srv.OwnerID, &srv.Description, &srv.CreatedAt, &srv.MemberCount)
	if err != nil {
		return nil, err
	}
	srv.UserRole = currentRole
	return &srv, nil
}

func (s *Store) LeaveServer(serverID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return errors.New("you are not a member of this server")
	} else if err != nil {
		return err
	}

	if role == "OWNER" {
		return errors.New("owner cannot leave the server. Please transfer ownership or delete the server.")
	}

	_, err = s.db.Exec(`DELETE FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID)
	return err
}

func (s *Store) CreateInvite(serverID, userID string, maxUses int) (*ServerInvite, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows || (role != "OWNER" && role != "ADMIN") {
		return nil, errors.New("unauthorized: only owner or admin can create invites")
	} else if err != nil {
		return nil, err
	}

	code := generateInviteCode()
	now := time.Now().UTC()
	_, err = s.db.Exec(`
INSERT INTO server_invites (code, server_id, created_by, max_uses, uses, created_at)
VALUES (?, ?, ?, ?, 0, ?)`, code, serverID, userID, maxUses, now)
	if err != nil {
		return nil, err
	}

	return &ServerInvite{
		Code:      code,
		ServerID:  serverID,
		CreatedBy: userID,
		MaxUses:   maxUses,
		Uses:      0,
		CreatedAt: now,
	}, nil
}

func (s *Store) ListInvites(serverID, userID string) ([]ServerInvite, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows || (role != "OWNER" && role != "ADMIN") {
		return nil, errors.New("unauthorized: only owner or admin can view invites")
	} else if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
SELECT code, server_id, created_by, max_uses, uses, expires_at, created_at
FROM server_invites WHERE server_id = ? ORDER BY created_at DESC`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invites := make([]ServerInvite, 0)
	for rows.Next() {
		var inv ServerInvite
		var expiresAt sql.NullTime
		if err := rows.Scan(&inv.Code, &inv.ServerID, &inv.CreatedBy, &inv.MaxUses, &inv.Uses, &expiresAt, &inv.CreatedAt); err == nil {
			if expiresAt.Valid {
				inv.ExpiresAt = &expiresAt.Time
			}
			invites = append(invites, inv)
		}
	}
	return invites, nil
}

func (s *Store) ListServerMembers(serverID, userID string) ([]ServerMember, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Requester must be member
	var checkRole string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&checkRole)
	if err == sql.ErrNoRows {
		return nil, errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
SELECT sm.server_id, sm.user_id, sm.role, sm.joined_at, u.username, u.display_name,
  COALESCE(u.avatar_url,''), COALESCE(u.peer_id, ''), u.last_seen
FROM server_members sm
JOIN users u ON sm.user_id = u.id
WHERE sm.server_id = ?
ORDER BY 
  CASE sm.role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END,
  u.display_name ASC`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]ServerMember, 0)
	for rows.Next() {
		var m ServerMember
		var lastSeen sql.NullTime
		if err := rows.Scan(&m.ServerID, &m.UserID, &m.Role, &m.JoinedAt, &m.Username, &m.DisplayName, &m.AvatarURL, &m.PeerID, &lastSeen); err == nil {
			if lastSeen.Valid {
				m.LastSeen = lastSeen.Time
			}
			m.Online = m.PeerID != "" && !m.LastSeen.IsZero() && time.Since(m.LastSeen) <= presenceTTL
			members = append(members, m)
		}
	}
	return members, nil
}

func (s *Store) ListChannelMessages(serverID, channelID, userID string) ([]ChannelMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return nil, errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(`
SELECT cm.id, cm.server_id, cm.channel_id, cm.user_id, u.username, u.display_name, COALESCE(u.avatar_url,''), cm.content,
  COALESCE(cm.attachment_url,''), COALESCE(cm.attachment_type,''), COALESCE(cm.reply_to_id,''), cm.created_at, cm.updated_at, cm.deleted_at
FROM channel_messages cm
JOIN users u ON cm.user_id = u.id
WHERE cm.server_id = ? AND cm.channel_id = ?
ORDER BY cm.created_at ASC
LIMIT 100`, serverID, channelID)
	if err != nil {
		// fallback without optional columns
		rows, err = s.db.Query(`
SELECT cm.id, cm.server_id, cm.channel_id, cm.user_id, u.username, u.display_name, COALESCE(u.avatar_url,''), cm.content, cm.created_at
FROM channel_messages cm
JOIN users u ON cm.user_id = u.id
WHERE cm.server_id = ? AND cm.channel_id = ?
ORDER BY cm.created_at ASC
LIMIT 100`, serverID, channelID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		messages := make([]ChannelMessage, 0)
		for rows.Next() {
			var msg ChannelMessage
			if err := rows.Scan(&msg.ID, &msg.ServerID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.DisplayName, &msg.AvatarURL, &msg.Content, &msg.CreatedAt); err == nil {
				messages = append(messages, msg)
			}
		}
		return messages, nil
	}
	defer rows.Close()

	messages := make([]ChannelMessage, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var msg ChannelMessage
		var updatedAt, deletedAt sql.NullTime
		if err := rows.Scan(&msg.ID, &msg.ServerID, &msg.ChannelID, &msg.UserID, &msg.Username, &msg.DisplayName, &msg.AvatarURL, &msg.Content, &msg.AttachmentURL, &msg.AttachmentType, &msg.ReplyToID, &msg.CreatedAt, &updatedAt, &deletedAt); err == nil {
			if updatedAt.Valid {
				msg.UpdatedAt = &updatedAt.Time
			}
			if deletedAt.Valid {
				msg.DeletedAt = &deletedAt.Time
				msg.Content = ""
			}
			messages = append(messages, msg)
			ids = append(ids, msg.ID)
		}
	}
	// reactions aggregate
	reactMap := s.loadChannelReactionsLocked(ids)
	for i := range messages {
		messages[i].Reactions = reactMap[messages[i].ID]
		if messages[i].ReplyToID != "" {
			var preview string
			var del sql.NullTime
			_ = s.db.QueryRow(`SELECT content, deleted_at FROM channel_messages WHERE id = ?`, messages[i].ReplyToID).Scan(&preview, &del)
			if del.Valid {
				preview = "(deleted)"
			}
			if len(preview) > 80 {
				preview = preview[:80] + "…"
			}
			messages[i].ReplyPreview = preview
		}
	}
	return messages, nil
}

func (s *Store) loadChannelReactionsLocked(ids []string) map[string][]struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
} {
	out := make(map[string][]struct {
		Emoji string `json:"emoji"`
		Count int    `json:"count"`
	})
	for _, id := range ids {
		rows, err := s.db.Query(`SELECT emoji, COUNT(*) FROM channel_reactions WHERE message_id = ? GROUP BY emoji`, id)
		if err != nil {
			continue
		}
		for rows.Next() {
			var emoji string
			var cnt int
			if rows.Scan(&emoji, &cnt) == nil {
				out[id] = append(out[id], struct {
					Emoji string `json:"emoji"`
					Count int    `json:"count"`
				}{Emoji: emoji, Count: cnt})
			}
		}
		rows.Close()
	}
	return out
}

func (s *Store) UpdateChannelMessage(messageID, userID, content string) (*ChannelMessage, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("message cannot be empty")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var senderID, serverID, channelID string
	var deletedAt sql.NullTime
	err := s.db.QueryRow(`SELECT user_id, server_id, channel_id, deleted_at FROM channel_messages WHERE id = ?`, messageID).
		Scan(&senderID, &serverID, &channelID, &deletedAt)
	if err == sql.ErrNoRows {
		return nil, errors.New("message not found")
	} else if err != nil {
		return nil, err
	}
	if senderID != userID {
		return nil, errors.New("only the author can edit this message")
	}
	if deletedAt.Valid {
		return nil, errors.New("message is deleted")
	}
	now := time.Now().UTC()
	_, err = s.db.Exec(`UPDATE channel_messages SET content = ?, updated_at = ? WHERE id = ?`, content, now, messageID)
	if err != nil {
		return nil, err
	}
	// return minimal
	author, _ := s.getByIDLocked(userID)
	msg := &ChannelMessage{ID: messageID, ServerID: serverID, ChannelID: channelID, UserID: userID, Content: content, UpdatedAt: &now, CreatedAt: now}
	if author != nil {
		msg.Username = author.Username
		msg.DisplayName = author.DisplayName
		msg.AvatarURL = author.AvatarURL
	}
	return msg, nil
}

func (s *Store) DeleteChannelMessage(messageID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var senderID string
	err := s.db.QueryRow(`SELECT user_id FROM channel_messages WHERE id = ?`, messageID).Scan(&senderID)
	if err == sql.ErrNoRows {
		return errors.New("message not found")
	} else if err != nil {
		return err
	}
	if senderID != userID {
		return errors.New("only the author can delete this message")
	}
	_, err = s.db.Exec(`UPDATE channel_messages SET deleted_at = ?, content = '', updated_at = ? WHERE id = ?`,
		time.Now().UTC(), time.Now().UTC(), messageID)
	return err
}

func (s *Store) ToggleChannelReaction(messageID, userID, emoji string) ([]struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
}, error) {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" || len(emoji) > 16 {
		return nil, errors.New("invalid emoji")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var serverID string
	err := s.db.QueryRow(`SELECT server_id FROM channel_messages WHERE id = ? AND deleted_at IS NULL`, messageID).Scan(&serverID)
	if err == sql.ErrNoRows {
		return nil, errors.New("message not found")
	} else if err != nil {
		return nil, err
	}
	// must be server member
	var role string
	err = s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return nil, errors.New("access denied")
	}
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM channel_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, messageID, userID, emoji).Scan(&n)
	if n > 0 {
		_, _ = s.db.Exec(`DELETE FROM channel_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, messageID, userID, emoji)
	} else {
		_, _ = s.db.Exec(`INSERT INTO channel_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`,
			messageID, userID, emoji, time.Now().UTC())
	}
	m := s.loadChannelReactionsLocked([]string{messageID})
	return m[messageID], nil
}

func (s *Store) CreateChannelMessage(serverID, channelID, userID, content, attachmentURL, attachmentType, replyToID, clientMessageID string) (*ChannelMessage, error) {
	content = strings.TrimSpace(content)
	attachmentURL = strings.TrimSpace(attachmentURL)
	replyToID = strings.TrimSpace(replyToID)
	if content == "" && attachmentURL == "" {
		return nil, errors.New("message cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	var role string
	err := s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return nil, errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return nil, err
	}

	author, err := s.getByIDLocked(userID)
	if err != nil || author == nil {
		return nil, errors.New("author not found")
	}

	clientMessageID = strings.TrimSpace(clientMessageID)
	if clientMessageID != "" {
		var existing ChannelMessage
		var attURL, attType, reply sql.NullString
		errEx := s.db.QueryRow(`
SELECT id, server_id, channel_id, user_id, content, COALESCE(attachment_url,''), COALESCE(attachment_type,''), COALESCE(reply_to_id,''), created_at
FROM channel_messages WHERE channel_id = ? AND client_message_id = ? LIMIT 1`, channelID, clientMessageID).
			Scan(&existing.ID, &existing.ServerID, &existing.ChannelID, &existing.UserID, &existing.Content, &attURL, &attType, &reply, &existing.CreatedAt)
		if errEx == nil {
			existing.AttachmentURL = attURL.String
			existing.AttachmentType = attType.String
			existing.ReplyToID = reply.String
			if author != nil {
				existing.Username = author.Username
				existing.DisplayName = author.DisplayName
				existing.AvatarURL = author.AvatarURL
			}
			return &existing, nil
		}
	}

	// ensure channel conversation exists (unified model)
	if _, errConv := s.EnsureChannelConversation(serverID, channelID); errConv != nil {
		_ = errConv
	}

	msgID := newID()
	now := time.Now().UTC()
	// Prefer full schema; fall back if columns missing
	_, err = s.db.Exec(`
INSERT INTO channel_messages (id, server_id, channel_id, user_id, content, attachment_url, attachment_type, reply_to_id, client_message_id, created_at)
VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?)`, msgID, serverID, channelID, userID, content, attachmentURL, attachmentType, replyToID, clientMessageID, now)
	if err != nil {
		// fallback: core columns only
		_, err2 := s.db.Exec(`
INSERT INTO channel_messages (id, server_id, channel_id, user_id, content, created_at)
VALUES (?, ?, ?, ?, ?, ?)`, msgID, serverID, channelID, userID, content, now)
		if err2 != nil {
			return nil, err // return original richer error
		}
	}

	return &ChannelMessage{
		ID:             msgID,
		ServerID:       serverID,
		ChannelID:      channelID,
		UserID:         userID,
		Username:       author.Username,
		DisplayName:    author.DisplayName,
		AvatarURL:      author.AvatarURL,
		Content:        content,
		AttachmentURL:  attachmentURL,
		AttachmentType: attachmentType,
		ReplyToID:      replyToID,
		CreatedAt:      now,
	}, nil
}

// GetVoiceChannel verifies the channel exists, is type voice, and user is a server member.
func (s *Store) GetVoiceChannel(channelID, userID string) (serverID, channelName, role string, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	channelID = strings.TrimSpace(channelID)
	if channelID == "" {
		return "", "", "", errors.New("channel id is required")
	}

	var chType, id string
	err = s.db.QueryRow(`
SELECT id, server_id, name, type FROM channels WHERE id = ?`, channelID).Scan(
		&id, &serverID, &channelName, &chType)
	if err == sql.ErrNoRows {
		return "", "", "", errors.New("channel not found")
	} else if err != nil {
		return "", "", "", err
	}
	if !strings.EqualFold(chType, "voice") {
		return "", "", "", errors.New("not a voice channel (type=" + chType + ")")
	}

	err = s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return "", "", "", errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return "", "", "", err
	}
	return serverID, channelName, role, nil
}

// GetChannelMeta returns basic channel info for authorized members.
func (s *Store) GetChannelMeta(channelID, userID string) (serverID, name, chType, role string, err error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	err = s.db.QueryRow(`SELECT server_id, name, type FROM channels WHERE id = ?`, channelID).Scan(&serverID, &name, &chType)
	if err == sql.ErrNoRows {
		return "", "", "", "", errors.New("channel not found")
	} else if err != nil {
		return "", "", "", "", err
	}
	err = s.db.QueryRow(`SELECT role FROM server_members WHERE server_id = ? AND user_id = ?`, serverID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return "", "", "", "", errors.New("access denied: you are not a member of this server")
	} else if err != nil {
		return "", "", "", "", err
	}
	return serverID, name, chType, role, nil
}

func (s *Store) ServerMemberIDs(serverID string) []string {
	return s.listIDs(`SELECT user_id FROM server_members WHERE server_id = ?`, serverID)
}
