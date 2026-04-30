package game

import (
	cryptorand "crypto/rand"
	"encoding/hex"
	"fmt"
	"math/rand"
	"sync"
)

type Session struct {
	ID    string
	State *GameState
	mu    sync.RWMutex
	feed  *FeedGenerator
	rng   *rand.Rand
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
		rng:   NewCombatRNG(),
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

func (s *Session) ScrollFeed() (*FeedPost, *Enemy, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase != "feed" {
		return nil, nil, nil, fmt.Errorf("cannot scroll when phase is %s", s.State.Phase)
	}

	post := s.feed.NextPost(s.State)
	var combatEnemy *Enemy
	if post.Type == PostTypeNormal {
		s.State.Score++
	} else if post.Type == PostTypeEvil {
		enemy, err := StartCombat(s.State, post.Content.EnemyID)
		if err != nil {
			return nil, nil, nil, err
		}
		combatEnemy = enemy
	}

	return post, combatEnemy, cloneState(s.State), nil
}

func (s *Session) HandleCombatAction(action PlayerAction) (*TurnResult, string, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "resolving"
	}
	turn, combatResult, err := ProcessCombatTurn(s.State, action, s.rng)
	if err != nil {
		return nil, "", nil, err
	}

	return turn, combatResult, cloneState(s.State), nil
}

func (s *Session) PreviewEnemyAction(action PlayerAction) (*CombatAction, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "enemy_thinking"
	}
	preview, err := PreviewEnemyCombatAction(s.State, action, s.rng)
	if err != nil {
		return nil, nil, err
	}
	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "enemy_reveal"
	}
	return preview, cloneState(s.State), nil
}

func (s *Session) ResolveCombatAction(action PlayerAction, enemyAction *CombatAction) (*TurnResult, string, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "resolving"
	}
	turn, combatResult, err := ProcessCombatTurnWithEnemyAction(s.State, action, enemyAction, s.rng)
	if err != nil {
		return nil, "", nil, err
	}
	return turn, combatResult, cloneState(s.State), nil
}

func cloneState(state *GameState) *GameState {
	if state == nil {
		return nil
	}

	cloned := *state
	cloned.DefeatedEnemies = append([]string(nil), state.DefeatedEnemies...)
	cloned.Exploits = state.Exploits
	cloned.Inventory = append([]*Exploit(nil), state.Inventory...)
	cloned.Items = append([]*Item(nil), state.Items...)

	if state.Combat != nil {
		combatCloned := *state.Combat
		if state.Combat.Enemy != nil {
			enemyCloned := *state.Combat.Enemy
			enemyCloned.Abilities = append([]EnemyAbility(nil), state.Combat.Enemy.Abilities...)
			if state.Combat.Enemy.StealableExploit != nil {
				exploitCloned := *state.Combat.Enemy.StealableExploit
				enemyCloned.StealableExploit = &exploitCloned
			}
			combatCloned.Enemy = &enemyCloned
		}
		combatCloned.EnemyDebuffs = cloneIntMap(state.Combat.EnemyDebuffs)
		combatCloned.PlayerDebuffs = cloneIntMap(state.Combat.PlayerDebuffs)
		combatCloned.DisabledExploits = cloneIntMap(state.Combat.DisabledExploits)
		combatCloned.Log = append([]TurnResult(nil), state.Combat.Log...)
		if state.Combat.PendingEnemyAction != nil {
			pending := *state.Combat.PendingEnemyAction
			combatCloned.PendingEnemyAction = &pending
		}
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
	if _, err := cryptorand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
