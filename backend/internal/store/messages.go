package store

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

// Unified message model (MVP). Existing DM/channel tables remain; this layer
// standardizes conversation typing + idempotent client_message_id.

const (
	ConvTypeChannel = "CHANNEL"
	ConvTypeDM      = "DM"
	ConvTypeGroupDM = "GROUP_DM"
)

// Message is the unified message payload returned to clients.
type Message struct {
	ID              string     `json:"id"`
	ConversationID  string     `json:"conversation_id"`
	SenderID        string     `json:"sender_id"`
	ClientMessageID string     `json:"client_message_id,omitempty"`
	Content         string     `json:"content"`
	ReplyToID       string     `json:"reply_to_id,omitempty"`
	AttachmentURL   string     `json:"attachment_url,omitempty"`
	AttachmentType  string     `json:"attachment_type,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
	// Denormalized author fields for clients
	Username    string `json:"username,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

func (s *Store) migrateUnifiedMessages() error {
	stmts := []string{
		`ALTER TABLE conversations ADD COLUMN server_id VARCHAR(64) NULL`,
		`ALTER TABLE conversations ADD COLUMN channel_id VARCHAR(64) NULL`,
		`ALTER TABLE direct_messages ADD COLUMN client_message_id VARCHAR(128) NULL`,
		`ALTER TABLE channel_messages ADD COLUMN client_message_id VARCHAR(128) NULL`,
		`ALTER TABLE channel_messages ADD COLUMN attachment_url TEXT NULL`,
		`ALTER TABLE channel_messages ADD COLUMN attachment_type VARCHAR(40) NULL`,
		`ALTER TABLE channel_messages ADD COLUMN reply_to_id VARCHAR(64) NULL`,
		`ALTER TABLE channel_messages ADD COLUMN updated_at DATETIME(6) NULL`,
		`ALTER TABLE channel_messages ADD COLUMN deleted_at DATETIME(6) NULL`,
		`CREATE TABLE IF NOT EXISTS channel_reactions (
  message_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE UNIQUE INDEX uq_dm_client_id ON direct_messages (conversation_id, client_message_id)`,
		`CREATE UNIQUE INDEX uq_ch_client_id ON channel_messages (channel_id, client_message_id)`,
		`CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  client_message_id VARCHAR(128) NULL,
  content TEXT NOT NULL,
  reply_to_id VARCHAR(64) NULL,
  attachment_url TEXT NULL,
  attachment_type VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NULL,
  deleted_at DATETIME(6) NULL,
  UNIQUE KEY uq_message_client_id (conversation_id, client_message_id),
  KEY idx_messages_conversation_created (conversation_id, created_at),
  KEY idx_messages_sender (sender_id),
  KEY idx_messages_reply (reply_to_id),
  KEY idx_messages_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			msg := strings.ToLower(err.Error())
			if strings.Contains(msg, "duplicate") || strings.Contains(msg, "exists") || strings.Contains(msg, "1060") || strings.Contains(msg, "1061") {
				continue
			}
			// non-fatal for unique index on nullable columns in some MySQL modes
			if strings.Contains(msg, "unique") {
				continue
			}
			return err
		}
	}
	return nil
}

// EnsureChannelConversation returns conversation id for a text channel.
func (s *Store) EnsureChannelConversation(serverID, channelID string) (string, error) {
	serverID = strings.TrimSpace(serverID)
	channelID = strings.TrimSpace(channelID)
	if serverID == "" || channelID == "" {
		return "", errors.New("server_id and channel_id required")
	}

	var id string
	err := s.db.QueryRow(`
SELECT id FROM conversations WHERE type IN ('CHANNEL','channel') AND channel_id = ? LIMIT 1`, channelID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		// column may not exist yet
		_ = s.migrateUnifiedMessages()
		err = s.db.QueryRow(`
SELECT id FROM conversations WHERE type IN ('CHANNEL','channel') AND channel_id = ? LIMIT 1`, channelID).Scan(&id)
		if err == nil {
			return id, nil
		}
	}

	id = newID()
	now := time.Now().UTC()
	_, err = s.db.Exec(`
INSERT INTO conversations (id, type, server_id, channel_id, created_at, updated_at)
VALUES (?, 'CHANNEL', ?, ?, ?, ?)`, id, serverID, channelID, now, now)
	if err != nil {
		// fallback without server/channel columns
		_, err2 := s.db.Exec(`
INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'CHANNEL', ?, ?)`, id, now, now)
		if err2 != nil {
			return "", err
		}
	}

	// add all server members as conversation members (best-effort)
	rows, err := s.db.Query(`SELECT user_id FROM server_members WHERE server_id = ?`, serverID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var uid string
			if rows.Scan(&uid) == nil {
				_, _ = s.db.Exec(`
INSERT IGNORE INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)`,
					id, uid, now)
			}
		}
	}
	return id, nil
}

// FindMessageByClientID returns existing message if client_message_id already stored (idempotency).
func (s *Store) FindDMByClientID(convID, clientID string) (*DMMessage, error) {
	if clientID == "" {
		return nil, sql.ErrNoRows
	}
	var msg DMMessage
	var replyTo, attURL, attType sql.NullString
	var updatedAt, deletedAt sql.NullTime
	err := s.db.QueryRow(`
SELECT id, conversation_id, sender_id, content, reply_to_id, attachment_url, attachment_type, created_at, updated_at, deleted_at
FROM direct_messages
WHERE conversation_id = ? AND client_message_id = ?
LIMIT 1`, convID, clientID).Scan(
		&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &replyTo, &attURL, &attType, &msg.CreatedAt, &updatedAt, &deletedAt)
	if err != nil {
		return nil, err
	}
	if replyTo.Valid {
		msg.ReplyToID = replyTo.String
	}
	if attURL.Valid {
		msg.AttachmentURL = attURL.String
	}
	if attType.Valid {
		msg.AttachmentType = attType.String
	}
	return &msg, nil
}
