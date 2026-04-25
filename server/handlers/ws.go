package handlers

import (
	"log"
	"net/http"

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
		State: session.State,
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
	}
}
