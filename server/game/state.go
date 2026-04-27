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
	Enemy             *Enemy         `json:"enemy"`
	EnemyHP           int            `json:"enemyHp"`
	Turn              string         `json:"turn"`
	TurnCount         int            `json:"turnCount"`
	PlayerBlock       bool           `json:"playerBlock"`
	PlayerParry       bool           `json:"playerParry"`
	PlayerBlockStreak int            `json:"playerBlockStreak"`
	LastPlayerExploit string         `json:"lastPlayerExploit"`
	LastEnemyAction   string         `json:"lastEnemyAction"`
	EnemyDebuffs      map[string]int `json:"enemyDebuffs"`
	PlayerDebuffs     map[string]int `json:"playerDebuffs"`
	DisabledExploits  map[string]int `json:"disabledExploits"`
	Log               []TurnResult   `json:"log"`
}

type TurnEffect struct {
	Target string `json:"target"`
	Kind   string `json:"kind"`
	Amount int    `json:"amount"`
	Label  string `json:"label"`
}

type TurnResult struct {
	PlayerAction    string       `json:"playerAction"`
	EnemyAction     string       `json:"enemyAction"`
	PlayerDamage    int          `json:"playerDamage"`
	EnemyDamage     int          `json:"enemyDamage"`
	EnemyHP         int          `json:"enemyHp"`
	PlayerAttention int          `json:"playerAttention"`
	Effects         []TurnEffect `json:"effects"`
}

type Enemy struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	MaxHP            int            `json:"maxHp"`
	BaseAttack       int            `json:"baseAttack"`
	Abilities        []EnemyAbility `json:"abilities"`
	StealableExploit *Exploit       `json:"stealableExploit,omitempty"`
}

type EnemyAbility struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	DamageMin           int    `json:"damageMin,omitempty"`
	DamageMax           int    `json:"damageMax,omitempty"`
	SelfHeal            int    `json:"selfHeal,omitempty"`
	NoiseDelta          int    `json:"noiseDelta,omitempty"`
	DisableExploitTurns int    `json:"disableExploitTurns,omitempty"`
	BypassBlock         bool   `json:"bypassBlock,omitempty"`
	IgnoreParry         bool   `json:"ignoreParry,omitempty"`
}

type PlayerAction struct {
	Action    string
	ExploitID string
}

type Exploit struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}

type Item struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewGameState(sessionID string) *GameState {
	focusedReply := &Exploit{ID: "focused_reply", Name: "Focused Reply", Kind: "damage"}
	deepScroll := &Exploit{ID: "deep_scroll", Name: "Deep Scroll", Kind: "heal"}

	return &GameState{
		SessionID:       sessionID,
		Phase:           "feed",
		Score:           0,
		Attention:       100,
		MaxAttention:    100,
		Noise:           1,
		DefeatedEnemies: []string{},
		Exploits:        [4]*Exploit{focusedReply, deepScroll, nil, nil},
		Inventory:       []*Exploit{focusedReply, deepScroll},
		Items:           []*Item{},
	}
}
