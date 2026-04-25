package game

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
)

type Session struct {
	ID    string
	State *GameState
}

var sessionStore = struct {
	sync.RWMutex
	sessions map[string]*Session
}{
	sessions: map[string]*Session{},
}

func CreateSession() (*Session, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:    sessionID,
		State: NewGameState(sessionID),
	}

	sessionStore.Lock()
	sessionStore.sessions[sessionID] = session
	sessionStore.Unlock()

	return session, nil
}

func GetSession(sessionID string) (*Session, bool) {
	sessionStore.RLock()
	session, ok := sessionStore.sessions[sessionID]
	sessionStore.RUnlock()
	return session, ok
}

func generateSessionID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
