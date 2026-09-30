package store

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

// Relationship states for social graph
const (
	RelNone            = "NONE"
	RelPendingSent     = "PENDING_SENT"
	RelPendingReceived = "PENDING_RECEIVED"
	RelFriends         = "FRIENDS"
	RelBlocked         = "BLOCKED"
)

// Privacy constants
const (
	PrivacyEveryone          = "everyone"
	PrivacyServerMembers     = "server_members"
	PrivacyFriendsOfFriends  = "friends_of_friends"
	PrivacyFriendsOnly       = "friends_only"
	PrivacyNobody            = "nobody"
	PrivacyPublic            = "public"
)

// PublicProfile is the safe DTO — never includes email, password, tokens, etc.
type PublicProfile struct {
	ID              string       `json:"id"`
	Username        string       `json:"username"`
	DisplayName     string       `json:"display_name"`
	AvatarURL       string       `json:"avatar_url,omitempty"`
	BannerURL       string       `json:"banner_url,omitempty"`
	Bio             string       `json:"bio,omitempty"`
	CustomStatus    string       `json:"custom_status,omitempty"`
	Online          bool         `json:"online"`
	PeerID          string       `json:"peer_id,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
	Relationship    string       `json:"relationship"` // NONE | PENDING_SENT | PENDING_RECEIVED | FRIENDS | BLOCKED
	MutualFriends   int          `json:"mutual_friends,omitempty"`
	MutualServers   []MutualServer `json:"mutual_servers,omitempty"`
}

type MutualServer struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon_url,omitempty"`
}

// MyProfile is the authenticated user's own profile (may include email + privacy).
type MyProfile struct {
	ID                   string    `json:"id"`
	Username             string    `json:"username"`
	Email                string    `json:"email"`
	DisplayName          string    `json:"display_name"`
	AvatarURL            string    `json:"avatar_url,omitempty"`
	BannerURL            string    `json:"banner_url,omitempty"`
	Bio                  string    `json:"bio,omitempty"`
	CustomStatus         string    `json:"custom_status,omitempty"`
	Online               bool      `json:"online"`
	CreatedAt            time.Time `json:"created_at"`
	PrivacyFriendRequest string    `json:"privacy_friend_request"`
	PrivacyDM            string    `json:"privacy_dm"`
	PrivacyProfile       string    `json:"privacy_profile"`
}

func (s *Store) migrateProfile() error {
	alters := []string{
		`ALTER TABLE users ADD COLUMN avatar_url TEXT NULL`,
		`ALTER TABLE users ADD COLUMN banner_url TEXT NULL`,
		`ALTER TABLE users ADD COLUMN bio VARCHAR(500) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN custom_status VARCHAR(120) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN privacy_friend_request VARCHAR(40) NOT NULL DEFAULT 'everyone'`,
		`ALTER TABLE users ADD COLUMN privacy_dm VARCHAR(40) NOT NULL DEFAULT 'everyone'`,
		`ALTER TABLE users ADD COLUMN privacy_profile VARCHAR(40) NOT NULL DEFAULT 'public'`,
	}
	for _, q := range alters {
		// Ignore "duplicate column" errors for idempotent migrate
		if _, err := s.db.Exec(q); err != nil {
			msg := strings.ToLower(err.Error())
			if strings.Contains(msg, "duplicate column") || strings.Contains(msg, "exists") {
				continue
			}
			// some MySQL variants
			if strings.Contains(msg, "1060") {
				continue
			}
			return err
		}
	}
	return nil
}

func (s *Store) scanUserProfile(row interface{ Scan(dest ...any) error }) (*User, error) {
	var u User
	var lastSeen sql.NullTime
	var avatar, banner, bio, custom, pFR, pDM, pProf sql.NullString
	// Try extended scan; fall back handled by caller if columns missing
	err := row.Scan(
		&u.ID, &u.Username, &u.Email, &u.DisplayName,
		&u.PasswordHash, &u.PasswordSalt, &u.PeerID, &lastSeen, &u.CreatedAt,
		&avatar, &banner, &bio, &custom, &pFR, &pDM, &pProf,
	)
	if err != nil {
		return nil, err
	}
	if lastSeen.Valid {
		u.LastSeen = lastSeen.Time
	}
	if avatar.Valid {
		u.AvatarURL = avatar.String
	}
	if banner.Valid {
		u.BannerURL = banner.String
	}
	if bio.Valid {
		u.Bio = bio.String
	}
	if custom.Valid {
		u.CustomStatus = custom.String
	}
	u.PrivacyFriendRequest = coalesce(pFR.String, PrivacyEveryone)
	u.PrivacyDM = coalesce(pDM.String, PrivacyEveryone)
	u.PrivacyProfile = coalesce(pProf.String, PrivacyPublic)
	return &u, nil
}

func coalesce(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

const userSelectExtended = `
SELECT id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at,
  COALESCE(avatar_url,''), COALESCE(banner_url,''), COALESCE(bio,''), COALESCE(custom_status,''),
  COALESCE(privacy_friend_request,'everyone'), COALESCE(privacy_dm,'everyone'), COALESCE(privacy_profile,'public')
FROM users`

func (s *Store) getByIDLocked(id string) (*User, error) {
	row := s.db.QueryRow(userSelectExtended+` WHERE id = ?`, id)
	u, err := s.scanUserProfile(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	// Fallback if columns somehow missing
	if err != nil {
		row2 := s.db.QueryRow(`SELECT id, username, email, display_name, password_hash, password_salt, peer_id, last_seen, created_at FROM users WHERE id = ?`, id)
		return s.scanUser(row2)
	}
	return u, nil
}

func (s *Store) Relationship(viewerID, targetID string) string {
	if viewerID == "" || targetID == "" || viewerID == targetID {
		return RelNone
	}
	// Blocked (either direction → treat as blocked for actions)
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`, viewerID, targetID).Scan(&n)
	if n > 0 {
		return RelBlocked
	}
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM friendships WHERE user_id = ? AND friend_id = ?`, viewerID, targetID).Scan(&n)
	if n > 0 {
		return RelFriends
	}
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM friend_requests WHERE from_id = ? AND to_id = ?`, viewerID, targetID).Scan(&n)
	if n > 0 {
		return RelPendingSent
	}
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM friend_requests WHERE from_id = ? AND to_id = ?`, targetID, viewerID).Scan(&n)
	if n > 0 {
		return RelPendingReceived
	}
	return RelNone
}

func (s *Store) GetMyProfile(userID string) (*MyProfile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, err := s.getByIDLocked(userID)
	if err != nil || u == nil {
		return nil, errors.New("user not found")
	}
	online := u.PeerID != "" && !u.LastSeen.IsZero() && time.Since(u.LastSeen) <= presenceTTL
	return &MyProfile{
		ID: u.ID, Username: u.Username, Email: u.Email, DisplayName: u.DisplayName,
		AvatarURL: u.AvatarURL, BannerURL: u.BannerURL, Bio: u.Bio, CustomStatus: u.CustomStatus,
		Online: online, CreatedAt: u.CreatedAt,
		PrivacyFriendRequest: coalesce(u.PrivacyFriendRequest, PrivacyEveryone),
		PrivacyDM:            coalesce(u.PrivacyDM, PrivacyEveryone),
		PrivacyProfile:       coalesce(u.PrivacyProfile, PrivacyPublic),
	}, nil
}

func (s *Store) UpdateMyProfile(userID string, in map[string]string) (*MyProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.getByIDLocked(userID)
	if err != nil || u == nil {
		return nil, errors.New("user not found")
	}

	display := u.DisplayName
	if v, ok := in["display_name"]; ok {
		display = strings.TrimSpace(v)
		if len(display) < 1 || len(display) > 120 {
			return nil, errors.New("display name must be 1-120 characters")
		}
	}
	bio := u.Bio
	if v, ok := in["bio"]; ok {
		bio = strings.TrimSpace(v)
		if len(bio) > 500 {
			return nil, errors.New("bio cannot exceed 500 characters")
		}
	}
	avatar := u.AvatarURL
	if v, ok := in["avatar_url"]; ok {
		avatar = strings.TrimSpace(v)
	}
	banner := u.BannerURL
	if v, ok := in["banner_url"]; ok {
		banner = strings.TrimSpace(v)
	}
	custom := u.CustomStatus
	if v, ok := in["custom_status"]; ok {
		custom = strings.TrimSpace(v)
		if len(custom) > 120 {
			return nil, errors.New("custom status too long")
		}
	}
	pFR := coalesce(u.PrivacyFriendRequest, PrivacyEveryone)
	if v, ok := in["privacy_friend_request"]; ok && validPrivacyFR(v) {
		pFR = v
	}
	pDM := coalesce(u.PrivacyDM, PrivacyEveryone)
	if v, ok := in["privacy_dm"]; ok && validPrivacyDM(v) {
		pDM = v
	}
	pProf := coalesce(u.PrivacyProfile, PrivacyPublic)
	if v, ok := in["privacy_profile"]; ok && (v == PrivacyPublic || v == PrivacyFriendsOnly) {
		pProf = v
	}

	_, err = s.db.Exec(`
UPDATE users SET display_name=?, bio=?, avatar_url=?, banner_url=?, custom_status=?,
  privacy_friend_request=?, privacy_dm=?, privacy_profile=? WHERE id=?`,
		display, bio, avatar, banner, custom, pFR, pDM, pProf, userID)
	if err != nil {
		return nil, err
	}
	online := false
	u2, _ := s.getByIDLocked(userID)
	if u2 != nil {
		online = u2.PeerID != "" && !u2.LastSeen.IsZero() && time.Since(u2.LastSeen) <= presenceTTL
	}
	return &MyProfile{
		ID: userID, Username: u.Username, Email: u.Email, DisplayName: display,
		AvatarURL: avatar, BannerURL: banner, Bio: bio, CustomStatus: custom,
		Online: online, CreatedAt: u.CreatedAt,
		PrivacyFriendRequest: pFR, PrivacyDM: pDM, PrivacyProfile: pProf,
	}, nil
}

func validPrivacyFR(v string) bool {
	switch v {
	case PrivacyEveryone, PrivacyServerMembers, PrivacyFriendsOfFriends, PrivacyFriendsOnly, PrivacyNobody:
		return true
	}
	return false
}
func validPrivacyDM(v string) bool {
	switch v {
	case PrivacyEveryone, PrivacyServerMembers, PrivacyFriendsOnly, PrivacyNobody:
		return true
	}
	return false
}

func (s *Store) shareServer(a, b string) bool {
	var n int
	_ = s.db.QueryRow(`
SELECT COUNT(1) FROM server_members a
JOIN server_members b ON a.server_id = b.server_id
WHERE a.user_id = ? AND b.user_id = ?`, a, b).Scan(&n)
	return n > 0
}

func (s *Store) canViewProfile(viewerID, targetID string, target *User) bool {
	if viewerID == targetID {
		return true
	}
	priv := coalesce(target.PrivacyProfile, PrivacyPublic)
	if priv == PrivacyPublic {
		return true
	}
	// friends only
	rel := s.Relationship(viewerID, targetID)
	return rel == RelFriends
}

func (s *Store) canSendFriendRequest(viewerID, targetID string, target *User) error {
	rel := s.Relationship(viewerID, targetID)
	if rel == RelFriends {
		return errors.New("already friends")
	}
	if rel == RelPendingSent {
		return errors.New("request already sent")
	}
	if rel == RelPendingReceived {
		return errors.New("this user has already requested you")
	}
	if rel == RelBlocked {
		return errors.New("cannot send request (blocked)")
	}
	// also check if target blocked viewer
	var n int
	_ = s.db.QueryRow(`SELECT COUNT(1) FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`, targetID, viewerID).Scan(&n)
	if n > 0 {
		return errors.New("cannot send request (blocked)")
	}

	priv := coalesce(target.PrivacyFriendRequest, PrivacyEveryone)
	switch priv {
	case PrivacyNobody:
		return errors.New("this user is not accepting friend requests")
	case PrivacyFriendsOnly:
		return errors.New("this user only accepts requests from friends of friends context restricted")
	case PrivacyServerMembers:
		if !s.shareServer(viewerID, targetID) {
			return errors.New("this user only accepts requests from server members")
		}
	case PrivacyFriendsOfFriends:
		// allow if mutual friend
		var m int
		_ = s.db.QueryRow(`
SELECT COUNT(1) FROM friendships f1
JOIN friendships f2 ON f1.friend_id = f2.friend_id
WHERE f1.user_id = ? AND f2.user_id = ?`, viewerID, targetID).Scan(&m)
		if m == 0 && !s.shareServer(viewerID, targetID) {
			return errors.New("this user only accepts requests from friends of friends")
		}
	}
	return nil
}

func (s *Store) GetPublicProfile(viewerID, targetID string) (*PublicProfile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	target, err := s.getByIDLocked(targetID)
	if err != nil || target == nil {
		return nil, errors.New("user not found")
	}
	if !s.canViewProfile(viewerID, targetID, target) {
		return nil, errors.New("profile is private")
	}

	online := target.PeerID != "" && !target.LastSeen.IsZero() && time.Since(target.LastSeen) <= presenceTTL
	peerID := ""
	if online {
		peerID = target.PeerID
	}
	rel := s.Relationship(viewerID, targetID)

	pp := &PublicProfile{
		ID: target.ID, Username: target.Username, DisplayName: target.DisplayName,
		AvatarURL: target.AvatarURL, BannerURL: target.BannerURL, Bio: target.Bio,
		CustomStatus: target.CustomStatus, Online: online, PeerID: peerID,
		CreatedAt: target.CreatedAt, Relationship: rel,
	}

	// Mutual friends count
	_ = s.db.QueryRow(`
SELECT COUNT(1) FROM friendships f1
JOIN friendships f2 ON f1.friend_id = f2.friend_id
WHERE f1.user_id = ? AND f2.user_id = ? AND f1.friend_id != ? AND f1.friend_id != ?`,
		viewerID, targetID, viewerID, targetID).Scan(&pp.MutualFriends)

	// Mutual servers
	rows, err := s.db.Query(`
SELECT s.id, s.name, COALESCE(s.icon_url,'')
FROM servers s
JOIN server_members a ON a.server_id = s.id AND a.user_id = ?
JOIN server_members b ON b.server_id = s.id AND b.user_id = ?
LIMIT 10`, viewerID, targetID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ms MutualServer
			if rows.Scan(&ms.ID, &ms.Name, &ms.Icon) == nil {
				pp.MutualServers = append(pp.MutualServers, ms)
			}
		}
	}
	if pp.MutualServers == nil {
		pp.MutualServers = []MutualServer{}
	}
	return pp, nil
}

// CancelFriendRequest cancels an outgoing request.
func (s *Store) CancelFriendRequest(fromID, toID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	res, err := s.db.Exec(`DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?`, fromID, toID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("request not found")
	}
	return nil
}
