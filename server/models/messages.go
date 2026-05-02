package models

import "github.com/viktorrrmil/the-feed/server/game"

type IncomingMessage struct {
	Type       string   `json:"type"`
	Action     string   `json:"action,omitempty"`
	ExploitID  string   `json:"exploitId,omitempty"`
	ExploitIDs []string `json:"exploitIds,omitempty"`
	ItemID     string   `json:"itemId,omitempty"`
	Decision   string   `json:"decision,omitempty"`
}

type StateUpdate struct {
	Type  string          `json:"type"`
	State *game.GameState `json:"state"`
}

type FeedPostMessage struct {
	Type string         `json:"type"`
	Post *game.FeedPost `json:"post"`
}

type CombatStartMessage struct {
	Type  string      `json:"type"`
	Enemy *game.Enemy `json:"enemy"`
}

type CombatResultMessage struct {
	Type string           `json:"type"`
	Turn *game.TurnResult `json:"turn"`
}

type CombatPhaseMessage struct {
	Type        string             `json:"type"`
	Phase       string             `json:"phase"`
	EnemyAction *game.CombatAction `json:"enemyAction,omitempty"`
	DelayMs     int                `json:"delayMs,omitempty"`
}

type CombatEndMessage struct {
	Type   string `json:"type"`
	Result string `json:"result"`
}

type GameOverMessage struct {
	Type  string `json:"type"`
	Score int    `json:"score"`
}

type ErrorMessage struct {
	Type  string `json:"type"`
	Error string `json:"error"`
}
