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
	mu    sync.RWMutex
	feed  *FeedGenerator
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
		feed:  NewFeedGenerator(),
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

func (s *Session) SnapshotState() *GameState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return cloneState(s.State)
}

func (s *Session) ScrollFeed() (*FeedPost, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase != "feed" {
		return nil, nil, fmt.Errorf("cannot scroll when phase is %s", s.State.Phase)
	}

	post := s.feed.NextPost(s.State)
	if post.Type == PostTypeNormal {
		s.State.Score++
	}

	return post, cloneState(s.State), nil
}

func cloneState(state *GameState) *GameState {
	if state == nil {
		return nil
	}

	cloned := *state
	cloned.DefeatedEnemies = append([]string(nil), state.DefeatedEnemies...)
	cloned.Inventory = append([]*Exploit(nil), state.Inventory...)
	cloned.Items = append([]*Item(nil), state.Items...)

	if state.Combat != nil {
		combatCloned := *state.Combat
		combatCloned.EnemyDebuffs = cloneIntMap(state.Combat.EnemyDebuffs)
		combatCloned.PlayerDebuffs = cloneIntMap(state.Combat.PlayerDebuffs)
		combatCloned.DisabledExploits = cloneIntMap(state.Combat.DisabledExploits)
		combatCloned.Log = append([]TurnResult(nil), state.Combat.Log...)
		cloned.Combat = &combatCloned
	}

	return &cloned
}

func cloneIntMap(input map[string]int) map[string]int {
	if input == nil {
		return nil
	}

	cloned := make(map[string]int, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func generateSessionID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
