package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
)

const (
	passwordSaltSize = 16
	passwordRounds   = 120000
)

func HashPassword(password string) (hash, salt string, err error) {
	if password == "" {
		return "", "", errors.New("password is required")
	}
	saltBytes := make([]byte, passwordSaltSize)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", "", err
	}
	derived := derive(password, saltBytes, passwordRounds)
	return base64.RawStdEncoding.EncodeToString(derived), base64.RawStdEncoding.EncodeToString(saltBytes), nil
}

func VerifyPassword(password, hash, salt string) bool {
	saltBytes, err := base64.RawStdEncoding.DecodeString(salt)
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(hash)
	if err != nil {
		return false
	}
	actual := derive(password, saltBytes, passwordRounds)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func derive(password string, salt []byte, rounds int) []byte {
	state := sha256.Sum256(append(append([]byte{}, salt...), []byte(password)...))
	buf := make([]byte, len(state))
	copy(buf, state[:])
	for i := 1; i < rounds; i++ {
		x := sha256.New()
		_, _ = x.Write(buf)
		_, _ = x.Write(salt)
		_, _ = x.Write([]byte(password))
		_, _ = x.Write([]byte(fmt.Sprintf("%d", i)))
		buf = x.Sum(nil)
	}
	return buf
}
