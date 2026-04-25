package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viktorrrmil/the-feed/server/game"
)

type sessionResponse struct {
	SessionID string          `json:"sessionId"`
	State     *game.GameState `json:"state"`
}

func CreateSession(c *gin.Context) {
	session, err := game.CreateSession()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sessionResponse{
		SessionID: session.ID,
		State:     session.State,
	})
}
