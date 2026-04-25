package game

type GameState struct {
	SessionID       string       `json:"sessionId"`
	Phase           string       `json:"phase"`
	Score           int          `json:"score"`
	Attention       int          `json:"attention"`
	MaxAttention    int          `json:"maxAttention"`
	Noise           int          `json:"noise"`
	DefeatedEnemies []string     `json:"defeatedEnemies"`
	Exploits        [4]*Exploit  `json:"exploits"`
	Inventory       []*Exploit   `json:"inventory"`
	Items           []*Item      `json:"items"`
	Combat          *CombatState `json:"combat"`
}

type CombatState struct {
	Enemy            *Enemy         `json:"enemy"`
	EnemyHP          int            `json:"enemyHp"`
	Turn             string         `json:"turn"`
	TurnCount        int            `json:"turnCount"`
	PlayerBlock      bool           `json:"playerBlock"`
	PlayerParry      bool           `json:"playerParry"`
	EnemyDebuffs     map[string]int `json:"enemyDebuffs"`
	PlayerDebuffs    map[string]int `json:"playerDebuffs"`
	DisabledExploits map[string]int `json:"disabledExploits"`
	Log              []TurnResult   `json:"log"`
}

type TurnResult struct {
	PlayerAction string `json:"playerAction"`
	EnemyAction  string `json:"enemyAction"`
}

type Enemy struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MaxHP      int    `json:"maxHp"`
	BaseAttack int    `json:"baseAttack"`
}

type Exploit struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Item struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewGameState(sessionID string) *GameState {
	return &GameState{
		SessionID:       sessionID,
		Phase:           "feed",
		Score:           0,
		Attention:       100,
		MaxAttention:    100,
		Noise:           1,
		DefeatedEnemies: []string{},
		Inventory:       []*Exploit{},
		Items:           []*Item{},
	}
}
