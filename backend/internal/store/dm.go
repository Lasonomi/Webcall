package store

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

type Conversation struct {
	ID          string      `json:"id"`
	Type        string      `json:"type"` // dm | group
	Name        string      `json:"name,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	Peer        *PublicUser `json:"peer,omitempty"`
	LastMessage *DMMessage  `json:"last_message,omitempty"`
	UnreadCount int         `json:"unread_count"`
}

type DMMessage struct {
	ID             string       `json:"id"`
	ConversationID string       `json:"conversation_id"`
	SenderID       string       `json:"sender_id"`
	SenderName     string       `json:"sender_name,omitempty"`
	AvatarURL      string       `json:"avatar_url,omitempty"`
	Content        string       `json:"content"`
	ReplyToID      string       `json:"reply_to_id,omitempty"`
	ReplyPreview   string       `json:"reply_preview,omitempty"`
	AttachmentURL  string       `json:"attachment_url,omitempty"`
	AttachmentType string       `json:"attachment_type,omitempty"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
	DeletedAt      *time.Time   `json:"deleted_at,omitempty"`
	IsMine         bool         `json:"is_mine,omitempty"`
	ReadByPeer     bool         `json:"read_by_peer,omitempty"`
	Reactions      []DMReaction `json:"reactions,omitempty"`
}

type DMReaction struct {
	Emoji  string `json:"emoji"`
	UserID string `json:"user_id"`
	Count  int    `json:"count,omitempty"`
}

func (s *Store) migrateDM() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(20) NOT NULL DEFAULT 'dm',
  name VARCHAR(120) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  last_read_at DATETIME(6) NULL,
  joined_at DATETIME(6) NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_convmem_user (user_id),
  CONSTRAINT fk_convmem_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_convmem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  reply_to_id VARCHAR(64) NULL,
  attachment_url TEXT NULL,
  attachment_type VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  deleted_at DATETIME(6) NULL,
  KEY idx_dm_conv (conversation_id, created_at),
  CONSTRAINT fk_dm_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_dm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS dm_reactions (
  message_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT fk_react_msg FOREIGN KEY (message_id) REFERENCES direct_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_react_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id VARCHAR(64) NOT NULL,
  blocked_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	// Existing databases created before group names were introduced need the column too.
	if _, err := s.db.Exec(`ALTER TABLE conversations ADD COLUMN name VARCHAR(120) NULL`); err != nil {
		msg := strings.ToLower(err.Error())
		if !strings.Contains(msg, "duplicate column") && !strings.Contains(msg, "1060") && !strings.Contains(msg, "exists") {
			return err
		}
	}
	return nil
}

func (s *Store) isBlockedLocked(a, b string) bool {
	var n int
	_ = s.db.QueryRow(`
SELECT COUNT(1) FROM user_blocks
WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
		a, b, b, a).Scan(&n)
	return n > 0
}

func (s *Store) IsBlocked(a, b string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isBlockedLocked(a, b)
}

func (s *Store) BlockUser(blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("cannot block yourself")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	target, err := s.getByIDLocked(blockedID)
	if err != nil || target == nil {
		return errors.New("user not found")
	}
	_, err = s.db.Exec(`INSERT IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)`,
		blockerID, blockedID, time.Now().UTC())
	return err
}

func (s *Store) UnblockUser(blockerID, blockedID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec(`DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`, blockerID, blockedID)
	return err
}

func (s *Store) ListBlocked(userID string) []PublicUser {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rows, err := s.db.Query(`SELECT blocked_id FROM user_blocks WHERE blocker_id = ?`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make([]PublicUser, 0)
	for rows.Next() {
		var id string
		if rows.Scan(&id) != nil {
			continue
		}
		u, err := s.getByIDLocked(id)
		if err != nil || u == nil {
			continue
		}
		out = append(out, public(u))
	}
	return out
}

func (s *Store) isMemberLocked(conversationID, userID string) bool {
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
		conversationID, userID).Scan(&n)
	return n > 0
}

// GetOrCreateDM finds existing 1:1 DM or creates one.

func (s *Store) canSendDM(viewerID, targetID string, target *User) error {
	priv := coalesce(target.PrivacyDM, PrivacyEveryone)
	switch priv {
	case PrivacyEveryone:
		return nil
	case PrivacyNobody:
		return errors.New("this user is not accepting direct messages")
	case PrivacyFriendsOnly:
		if s.relationshipLocked(viewerID, targetID) != RelFriends {
			return errors.New("this user only accepts direct messages from friends")
		}
	case PrivacyServerMembers:
		if !s.shareServerLocked(viewerID, targetID) {
			return errors.New("this user only accepts direct messages from shared server members")
		}
	default:
		return nil
	}
	return nil
}

func (s *Store) CreateGroupConversation(ownerID string, memberIDs []string, name string) (*Conversation, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Group"
	}
	if len(name) > 120 {
		return nil, errors.New("group name cannot exceed 120 characters")
	}
	// unique members including owner
	set := map[string]bool{ownerID: true}
	for _, id := range memberIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			set[id] = true
		}
	}
	if len(set) < 2 {
		return nil, errors.New("group needs at least 2 members")
	}
	if len(set) > 20 {
		return nil, errors.New("group max 20 members")
	}
	ids := make([]string, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}

	s.mu.Lock()
	for _, id := range ids {
		u, err := s.getByIDLocked(id)
		if err != nil || u == nil {
			return nil, errors.New("group member not found")
		}
	}
	defer s.mu.Unlock()

	convID := newID()
	now := time.Now().UTC()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err = tx.Exec(`INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'group', ?, ?)`, convID, now, now); err != nil {
		return nil, err
	}
	_, err = tx.Exec(`UPDATE conversations SET name = ? WHERE id = ?`, name, convID)
	if err != nil {
		return nil, err
	}

	for _, id := range ids {
		if _, err = tx.Exec(`INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?)`, convID, id, now); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return s.getConversationLocked(convID, ownerID)
}

func (s *Store) GetOrCreateDM(userID, peerID string) (*Conversation, error) {
	userID = strings.TrimSpace(userID)
	peerID = strings.TrimSpace(peerID)
	if userID == "" || peerID == "" {
		return nil, errors.New("user ids required")
	}
	if userID == peerID {
		return nil, errors.New("cannot DM yourself")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	peer, err := s.getByIDLocked(peerID)
	if err != nil || peer == nil {
		return nil, errors.New("user not found")
	}
	me, err := s.getByIDLocked(userID)
	if err != nil || me == nil {
		return nil, errors.New("user not found")
	}
	if s.isBlockedLocked(userID, peerID) {
		return nil, errors.New("cannot message this user (blocked)")
	}
	if err := s.canSendDM(userID, peerID, peer); err != nil {
		return nil, err
	}

	// Existing DM between the two users
	var convID string
	err = s.db.QueryRow(`
SELECT cm1.conversation_id
FROM conversation_members cm1
JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
JOIN conversations c ON c.id = cm1.conversation_id
WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.type = 'dm'
LIMIT 1`, userID, peerID).Scan(&convID)
	if err == nil && convID != "" {
		return s.getConversationLocked(convID, userID)
	}

	now := time.Now().UTC()
	convID = newID()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err = tx.Exec(`INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, 'dm', ?, ?)`,
		convID, now, now); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(`INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, ?), (?, ?, ?)`,
		convID, userID, now, convID, peerID, now); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return s.getConversationLocked(convID, userID)
}

func (s *Store) getConversationLocked(convID, viewerID string) (*Conversation, error) {
	var c Conversation
	err := s.db.QueryRow(`SELECT id, type, COALESCE(name, ''), created_at, updated_at FROM conversations WHERE id = ?`, convID).
		Scan(&c.ID, &c.Type, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if !s.isMemberLocked(convID, viewerID) {
		return nil, errors.New("access denied")
	}

	// Peer for DM
	rows, err := s.db.Query(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`, convID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var uid string
			if rows.Scan(&uid) != nil {
				continue
			}
			if uid == viewerID {
				continue
			}
			u, e := s.getByIDLocked(uid)
			if e == nil && u != nil {
				pu := public(u)
				c.Peer = &pu
			}
		}
	}

	// Unread
	var lastRead sql.NullTime
	_ = s.db.QueryRow(`SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
		convID, viewerID).Scan(&lastRead)
	if lastRead.Valid {
		_ = s.db.QueryRow(`
SELECT COUNT(1) FROM direct_messages
WHERE conversation_id = ? AND sender_id != ? AND deleted_at IS NULL AND created_at > ?`,
			convID, viewerID, lastRead.Time).Scan(&c.UnreadCount)
	} else {
		_ = s.db.QueryRow(`
SELECT COUNT(1) FROM direct_messages
WHERE conversation_id = ? AND sender_id != ? AND deleted_at IS NULL`,
			convID, viewerID).Scan(&c.UnreadCount)
	}

	// Last message
	var msg DMMessage
	var deletedAt sql.NullTime
	var replyTo, attURL, attType sql.NullString
	err = s.db.QueryRow(`
SELECT id, conversation_id, sender_id, content, reply_to_id, attachment_url, attachment_type, created_at, updated_at, deleted_at
FROM direct_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`, convID).
		Scan(&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &replyTo, &attURL, &attType, &msg.CreatedAt, &msg.UpdatedAt, &deletedAt)
	if err == nil {
		if replyTo.Valid {
			msg.ReplyToID = replyTo.String
		}
		if attURL.Valid {
			msg.AttachmentURL = attURL.String
		}
		if attType.Valid {
			msg.AttachmentType = attType.String
		}
		if deletedAt.Valid {
			msg.DeletedAt = &deletedAt.Time
			msg.Content = ""
		}
		msg.IsMine = msg.SenderID == viewerID
		c.LastMessage = &msg
	}
	return &c, nil
}

func (s *Store) ListConversations(userID string) ([]Conversation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query(`
SELECT c.id FROM conversations c
JOIN conversation_members cm ON cm.conversation_id = c.id
WHERE cm.user_id = ?
ORDER BY c.updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Conversation, 0)
	for rows.Next() {
		var id string
		if rows.Scan(&id) != nil {
			continue
		}
		conv, err := s.getConversationLocked(id, userID)
		if err == nil && conv != nil {
			list = append(list, *conv)
		}
	}
	return list, nil
}

func (s *Store) GetConversation(convID, userID string) (*Conversation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getConversationLocked(convID, userID)
}

func (s *Store) ListDMMessages(convID, userID string, limit int) ([]DMMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.isMemberLocked(convID, userID) {
		return nil, errors.New("access denied")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.db.Query(`
SELECT dm.id, dm.conversation_id, dm.sender_id, u.display_name, COALESCE(u.avatar_url,''), dm.content, dm.reply_to_id,
  dm.attachment_url, dm.attachment_type, dm.created_at, dm.updated_at, dm.deleted_at
FROM direct_messages dm
JOIN users u ON u.id = dm.sender_id
WHERE dm.conversation_id = ?
ORDER BY dm.created_at ASC
LIMIT ?`, convID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	msgs := make([]DMMessage, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var m DMMessage
		var replyTo, attURL, attType sql.NullString
		var deletedAt sql.NullTime
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderName, &m.AvatarURL, &m.Content,
			&replyTo, &attURL, &attType, &m.CreatedAt, &m.UpdatedAt, &deletedAt); err != nil {
			continue
		}
		if replyTo.Valid {
			m.ReplyToID = replyTo.String
		}
		if attURL.Valid {
			m.AttachmentURL = attURL.String
		}
		if attType.Valid {
			m.AttachmentType = attType.String
		}
		if deletedAt.Valid {
			m.DeletedAt = &deletedAt.Time
			m.Content = ""
		}
		m.IsMine = m.SenderID == userID
		msgs = append(msgs, m)
		ids = append(ids, m.ID)
	}

	// Reactions
	reactMap := s.loadReactionsLocked(ids)
	for i := range msgs {
		msgs[i].Reactions = reactMap[msgs[i].ID]
	}

	// Reply previews
	for i := range msgs {
		if msgs[i].ReplyToID == "" {
			continue
		}
		var preview string
		var del sql.NullTime
		_ = s.db.QueryRow(`SELECT content, deleted_at FROM direct_messages WHERE id = ?`, msgs[i].ReplyToID).
			Scan(&preview, &del)
		if del.Valid {
			preview = "(deleted)"
		}
		if len(preview) > 80 {
			preview = preview[:80] + "…"
		}
		msgs[i].ReplyPreview = preview
	}
	return msgs, nil
}

func (s *Store) loadReactionsLocked(messageIDs []string) map[string][]DMReaction {
	out := make(map[string][]DMReaction)
	if len(messageIDs) == 0 {
		return out
	}
	// simple loop (fine for ≤100 msgs)
	for _, mid := range messageIDs {
		rows, err := s.db.Query(`SELECT emoji, user_id FROM dm_reactions WHERE message_id = ?`, mid)
		if err != nil {
			continue
		}
		agg := map[string][]string{}
		for rows.Next() {
			var emoji, uid string
			if rows.Scan(&emoji, &uid) == nil {
				agg[emoji] = append(agg[emoji], uid)
			}
		}
		rows.Close()
		list := make([]DMReaction, 0, len(agg))
		for emoji, users := range agg {
			list = append(list, DMReaction{Emoji: emoji, UserID: users[0], Count: len(users)})
		}
		out[mid] = list
	}
	return out
}

func (s *Store) CreateDMMessage(convID, senderID, content, replyToID, attachmentURL, attachmentType string) (*DMMessage, error) {
	content = strings.TrimSpace(content)
	if content == "" && strings.TrimSpace(attachmentURL) == "" {
		return nil, errors.New("message cannot be empty")
	}
	if len(content) > 4000 {
		return nil, errors.New("message too long")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isMemberLocked(convID, senderID) {
		return nil, errors.New("access denied")
	}

	// peer block/privacy checks for 1:1 DMs; group DMs are unaffected.
	peerID := s.dmPeerLocked(convID, senderID)
	if peerID != "" {
		if s.isBlockedLocked(senderID, peerID) {
			return nil, errors.New("cannot message this user (blocked)")
		}
		peer, peerErr := s.getByIDLocked(peerID)
		if peerErr != nil || peer == nil {
			return nil, errors.New("peer user not found")
		}
		if err := s.canSendDM(senderID, peerID, peer); err != nil {
			return nil, err
		}
	}

	sender, err := s.getByIDLocked(senderID)
	if err != nil || sender == nil {
		return nil, errors.New("sender not found")
	}

	now := time.Now().UTC()
	id := newID()
	_, err = s.db.Exec(`
INSERT INTO direct_messages (id, conversation_id, sender_id, content, reply_to_id, attachment_url, attachment_type, created_at, updated_at)
VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?, ?)`,
		id, convID, senderID, content, replyToID, attachmentURL, attachmentType, now, now)
	if err != nil {
		return nil, err
	}
	_, _ = s.db.Exec(`UPDATE conversations SET updated_at = ? WHERE id = ?`, now, convID)

	msg := &DMMessage{
		ID:             id,
		ConversationID: convID,
		SenderID:       senderID,
		SenderName:     sender.DisplayName,
		AvatarURL:      sender.AvatarURL,
		Content:        content,
		ReplyToID:      replyToID,
		AttachmentURL:  attachmentURL,
		AttachmentType: attachmentType,
		CreatedAt:      now,
		UpdatedAt:      now,
		IsMine:         true,
	}
	return msg, nil
}

func (s *Store) dmPeerLocked(convID, userID string) string {
	rows, err := s.db.Query(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`, convID)
	if err != nil {
		return ""
	}
	defer rows.Close()
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) == nil && uid != userID {
			return uid
		}
	}
	return ""
}

func (s *Store) UpdateDMMessage(messageID, userID, content string) (*DMMessage, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("message cannot be empty")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var senderID, convID string
	var deletedAt sql.NullTime
	err := s.db.QueryRow(`SELECT sender_id, conversation_id, deleted_at FROM direct_messages WHERE id = ?`, messageID).
		Scan(&senderID, &convID, &deletedAt)
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
	_, err = s.db.Exec(`UPDATE direct_messages SET content = ?, updated_at = ? WHERE id = ?`, content, now, messageID)
	if err != nil {
		return nil, err
	}
	return s.getMessageLocked(messageID, userID)
}

func (s *Store) ConversationMemberIDsFromMessage(messageID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var conversationID string
	if err := s.db.QueryRow(`SELECT conversation_id FROM direct_messages WHERE id = ?`, messageID).Scan(&conversationID); err != nil {
		return nil
	}
	return s.conversationMemberIDsLocked(conversationID)
}

func (s *Store) conversationMemberIDsLocked(convID string) []string {
	rows, err := s.db.Query(`SELECT user_id FROM conversation_members WHERE conversation_id = ?`, convID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *Store) DeleteDMMessage(messageID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var senderID string
	err := s.db.QueryRow(`SELECT sender_id FROM direct_messages WHERE id = ?`, messageID).Scan(&senderID)
	if err == sql.ErrNoRows {
		return errors.New("message not found")
	} else if err != nil {
		return err
	}
	if senderID != userID {
		return errors.New("only the author can delete this message")
	}
	_, err = s.db.Exec(`UPDATE direct_messages SET deleted_at = ?, content = '', updated_at = ? WHERE id = ?`,
		time.Now().UTC(), time.Now().UTC(), messageID)
	return err
}

func (s *Store) getMessageLocked(messageID, viewerID string) (*DMMessage, error) {
	var m DMMessage
	var replyTo, attURL, attType sql.NullString
	var deletedAt sql.NullTime
	var name string
	err := s.db.QueryRow(`
SELECT dm.id, dm.conversation_id, dm.sender_id, u.display_name, dm.content, dm.reply_to_id,
  dm.attachment_url, dm.attachment_type, dm.created_at, dm.updated_at, dm.deleted_at
FROM direct_messages dm JOIN users u ON u.id = dm.sender_id WHERE dm.id = ?`, messageID).
		Scan(&m.ID, &m.ConversationID, &m.SenderID, &name, &m.Content, &replyTo, &attURL, &attType, &m.CreatedAt, &m.UpdatedAt, &deletedAt)
	if err != nil {
		return nil, err
	}
	m.SenderName = name
	if replyTo.Valid {
		m.ReplyToID = replyTo.String
	}
	if attURL.Valid {
		m.AttachmentURL = attURL.String
	}
	if attType.Valid {
		m.AttachmentType = attType.String
	}
	if deletedAt.Valid {
		m.DeletedAt = &deletedAt.Time
		m.Content = ""
	}
	m.IsMine = m.SenderID == viewerID
	return &m, nil
}

func (s *Store) MarkConversationRead(convID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.isMemberLocked(convID, userID) {
		return errors.New("access denied")
	}
	_, err := s.db.Exec(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`,
		time.Now().UTC(), convID, userID)
	return err
}

func (s *Store) ToggleReaction(messageID, userID, emoji string) ([]DMReaction, error) {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" || len(emoji) > 16 {
		return nil, errors.New("invalid emoji")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var convID string
	err := s.db.QueryRow(`SELECT conversation_id FROM direct_messages WHERE id = ? AND deleted_at IS NULL`, messageID).Scan(&convID)
	if err == sql.ErrNoRows {
		return nil, errors.New("message not found")
	} else if err != nil {
		return nil, err
	}
	if !s.isMemberLocked(convID, userID) {
		return nil, errors.New("access denied")
	}

	var n int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM dm_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
		messageID, userID, emoji).Scan(&n)
	if n > 0 {
		_, _ = s.db.Exec(`DELETE FROM dm_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, messageID, userID, emoji)
	} else {
		_, _ = s.db.Exec(`INSERT INTO dm_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)`,
			messageID, userID, emoji, time.Now().UTC())
	}
	m := s.loadReactionsLocked([]string{messageID})
	return m[messageID], nil
}

func (s *Store) SearchDMMessages(convID, userID, query string) ([]DMMessage, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, errors.New("query required")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.isMemberLocked(convID, userID) {
		return nil, errors.New("access denied")
	}
	like := "%" + query + "%"
	rows, err := s.db.Query(`
SELECT dm.id, dm.conversation_id, dm.sender_id, u.display_name, dm.content, dm.reply_to_id,
  dm.attachment_url, dm.attachment_type, dm.created_at, dm.updated_at, dm.deleted_at
FROM direct_messages dm JOIN users u ON u.id = dm.sender_id
WHERE dm.conversation_id = ? AND dm.deleted_at IS NULL AND dm.content LIKE ?
ORDER BY dm.created_at DESC LIMIT 50`, convID, like)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	msgs := make([]DMMessage, 0)
	for rows.Next() {
		var m DMMessage
		var replyTo, attURL, attType sql.NullString
		var deletedAt sql.NullTime
		if rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.SenderName, &m.Content,
			&replyTo, &attURL, &attType, &m.CreatedAt, &m.UpdatedAt, &deletedAt) != nil {
			continue
		}
		if replyTo.Valid {
			m.ReplyToID = replyTo.String
		}
		m.IsMine = m.SenderID == userID
		msgs = append(msgs, m)
	}
	return msgs, nil
}

func (s *Store) ConversationMemberIDs(convID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.conversationMemberIDsLocked(convID)
}
