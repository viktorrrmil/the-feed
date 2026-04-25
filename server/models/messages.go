package models

import "github.com/viktorrrmil/the-feed/server/game"

type IncomingMessage struct {
	Type      string `json:"type"`
	Action    string `json:"action,omitempty"`
	ExploitID string `json:"exploitId,omitempty"`
	ItemID    string `json:"itemId,omitempty"`
}

type StateUpdate struct {
	Type  string          `json:"type"`
	State *game.GameState `json:"state"`
}
