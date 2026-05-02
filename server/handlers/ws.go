package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/viktorrrmil/the-feed/server/game"
	"github.com/viktorrrmil/the-feed/server/models"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func HandleWebSocket(c *gin.Context) {
	sessionID := c.Param("sessionId")
	session, ok := game.GetSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws upgrade failed: %v", err)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			log.Printf("ws close failed: %v", err)
		}
	}()

	if err := conn.WriteJSON(models.StateUpdate{
		Type:  "STATE_UPDATE",
		State: session.SnapshotState(),
	}); err != nil {
		log.Printf("ws initial state send failed: %v", err)
		return
	}

	for {
		var incoming models.IncomingMessage
		if err := conn.ReadJSON(&incoming); err != nil {
			log.Printf("ws read failed: %v", err)
			return
		}

		switch incoming.Type {
		case "SCROLL":
			post, combatEnemy, state, err := session.ScrollFeed()
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send error message failed: %v", writeErr)
					return
				}
				continue
			}

			if err := conn.WriteJSON(models.FeedPostMessage{
				Type: "FEED_POST",
				Post: post,
			}); err != nil {
				log.Printf("ws feed post send failed: %v", err)
				return
			}

			if combatEnemy != nil {
				if err := conn.WriteJSON(models.CombatStartMessage{
					Type:  "COMBAT_START",
					Enemy: combatEnemy,
				}); err != nil {
					log.Printf("ws combat start send failed: %v", err)
					return
				}
			}

			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws state update send failed: %v", err)
				return
			}
		case "SELECT_REWARD_EXPLOIT":
			state, err := session.SelectRewardExploit(incoming.ExploitID)
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send reward error message failed: %v", writeErr)
					return
				}
				continue
			}
			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws reward state update send failed: %v", err)
				return
			}
		case "RESOLVE_REWARD_ITEM":
			state, err := session.ResolveRewardItem(incoming.ItemID, incoming.Decision)
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send reward item error message failed: %v", writeErr)
					return
				}
				continue
			}
			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws reward item state update send failed: %v", err)
				return
			}
		case "COMPLETE_REWARDS":
			state, err := session.CompleteRewards()
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send reward completion error message failed: %v", writeErr)
					return
				}
				continue
			}
			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws reward completion state update send failed: %v", err)
				return
			}
		case "UPDATE_LOADOUT":
			state, err := session.UpdateLoadout(incoming.ExploitIDs)
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send loadout error message failed: %v", writeErr)
					return
				}
				continue
			}
			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws loadout state update send failed: %v", err)
				return
			}
		case "COMBAT_ACTION":
			playerAction := game.PlayerAction{
				Action:    incoming.Action,
				ExploitID: incoming.ExploitID,
			}

			if err := conn.WriteJSON(models.CombatPhaseMessage{
				Type:    "COMBAT_PHASE",
				Phase:   "enemy_thinking",
				DelayMs: 1200,
			}); err != nil {
				log.Printf("ws combat phase send failed: %v", err)
				return
			}

			enemyAction, _, err := session.PreviewEnemyAction(playerAction)
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send combat error message failed: %v", writeErr)
					return
				}
				continue
			}

			time.Sleep(1200 * time.Millisecond)

			if err := conn.WriteJSON(models.CombatPhaseMessage{
				Type:        "COMBAT_PHASE",
				Phase:       "enemy_reveal",
				EnemyAction: enemyAction,
				DelayMs:     450,
			}); err != nil {
				log.Printf("ws enemy reveal send failed: %v", err)
				return
			}

			time.Sleep(450 * time.Millisecond)

			if err := conn.WriteJSON(models.CombatPhaseMessage{
				Type:  "COMBAT_PHASE",
				Phase: "resolving",
			}); err != nil {
				log.Printf("ws resolving phase send failed: %v", err)
				return
			}

			turn, combatResult, state, err := session.ResolveCombatAction(playerAction, enemyAction)
			if err != nil {
				if writeErr := conn.WriteJSON(models.ErrorMessage{
					Type:  "ERROR",
					Error: err.Error(),
				}); writeErr != nil {
					log.Printf("ws send combat error message failed: %v", writeErr)
					return
				}
				continue
			}

			if err := conn.WriteJSON(models.CombatResultMessage{
				Type: "COMBAT_RESULT",
				Turn: turn,
			}); err != nil {
				log.Printf("ws combat result send failed: %v", err)
				return
			}

			if combatResult != "" {
				if err := conn.WriteJSON(models.CombatEndMessage{
					Type:   "COMBAT_END",
					Result: combatResult,
				}); err != nil {
					log.Printf("ws combat end send failed: %v", err)
					return
				}
				if combatResult == "lose" {
					if err := conn.WriteJSON(models.GameOverMessage{
						Type:  "GAME_OVER",
						Score: state.Score,
					}); err != nil {
						log.Printf("ws game over send failed: %v", err)
						return
					}
				}
			}

			if err := conn.WriteJSON(models.StateUpdate{
				Type:  "STATE_UPDATE",
				State: state,
			}); err != nil {
				log.Printf("ws state update send failed: %v", err)
				return
			}
		default:
			if err := conn.WriteJSON(models.ErrorMessage{
				Type:  "ERROR",
				Error: "unsupported message type",
			}); err != nil {
				log.Printf("ws unsupported message error send failed: %v", err)
				return
			}
		}
	}
}
