package game

type GameState struct {
	SessionID       string       `json:"sessionId"`
	Phase           string       `json:"phase"`
	Score           int          `json:"score"`
	Attention       int          `json:"attention"`
	MaxAttention    int          `json:"maxAttention"`
	Attack          int          `json:"attack"`
	Block           int          `json:"block"`
	Parry           int          `json:"parry"`
	Noise           int          `json:"noise"`
	DefeatedEnemies []string     `json:"defeatedEnemies"`
	Exploits        [4]*Exploit  `json:"exploits"`
	Inventory       []*Exploit   `json:"inventory"`
	Items           []*Item      `json:"items"`
	Reward          *RewardState `json:"reward"`
	Progress        *RunProgress `json:"progress"`
	Combat          *CombatState `json:"combat"`
}

type RunProgress struct {
	CombatsWon        int `json:"combatsWon"`
	ExploitsCollected int `json:"exploitsCollected"`
	ItemsKept         int `json:"itemsKept"`
	ItemsDiscarded    int `json:"itemsDiscarded"`
}

type CombatState struct {
	Enemy                *Enemy         `json:"enemy"`
	EnemyHP              int            `json:"enemyHp"`
	Turn                 string         `json:"turn"`
	TurnPhase            string         `json:"turnPhase"`
	TurnCount            int            `json:"turnCount"`
	PlayerBlock          bool           `json:"playerBlock"`
	PlayerParry          bool           `json:"playerParry"`
	EnemyBlock           bool           `json:"enemyBlock"`
	EnemyParry           bool           `json:"enemyParry"`
	PlayerBlockStreak    int            `json:"playerBlockStreak"`
	LastPlayerExploit    string         `json:"lastPlayerExploit"`
	LastEnemyAction      string         `json:"lastEnemyAction"`
	LastEnemyActionValue int            `json:"lastEnemyActionValue"`
	LastEnemyActionCost  int            `json:"lastEnemyActionCost"`
	PendingEnemyAction   *CombatAction  `json:"pendingEnemyAction,omitempty"`
	EnemyDebuffs         map[string]int `json:"enemyDebuffs"`
	PlayerDebuffs        map[string]int `json:"playerDebuffs"`
	DisabledExploits     map[string]int `json:"disabledExploits"`
	Log                  []TurnResult   `json:"log"`
}

type TurnEffect struct {
	Target string `json:"target"`
	Kind   string `json:"kind"`
	Amount int    `json:"amount"`
	Label  string `json:"label"`
}

type TurnResult struct {
	PlayerAction      string       `json:"playerAction"`
	EnemyAction       string       `json:"enemyAction"`
	PlayerDamage      int          `json:"playerDamage"`
	EnemyDamage       int          `json:"enemyDamage"`
	EnemyHP           int          `json:"enemyHp"`
	EnemyAttention    int          `json:"enemyAttention"`
	PlayerAttention   int          `json:"playerAttention"`
	PlayerActionCost  int          `json:"playerActionCost"`
	EnemyActionCost   int          `json:"enemyActionCost"`
	PlayerActionValue int          `json:"playerActionValue"`
	EnemyActionValue  int          `json:"enemyActionValue"`
	PlayerATSpent     int          `json:"playerATSpent"`
	EnemyATSpent      int          `json:"enemyATSpent"`
	PlayerATRefund    int          `json:"playerATRefund"`
	EnemyATRefund     int          `json:"enemyATRefund"`
	PlayerPenaltyAT   int          `json:"playerPenaltyAT"`
	EnemyPenaltyAT    int          `json:"enemyPenaltyAT"`
	PlayerState       string       `json:"playerState"`
	EnemyState        string       `json:"enemyState"`
	Effects           []TurnEffect `json:"effects"`
}

type CombatAction struct {
	Type      string `json:"type"`
	Label     string `json:"label"`
	Cost      int    `json:"cost"`
	Value     int    `json:"value"`
	ExploitID string `json:"exploitId,omitempty"`
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
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Kind        string       `json:"kind"`
	Description string       `json:"description"`
	Effects     []StatEffect `json:"effects,omitempty"`
}

type Item struct {
	ID                string       `json:"id"`
	Name              string       `json:"name"`
	Description       string       `json:"description"`
	Image             string       `json:"image"`
	Effects           []StatEffect `json:"effects,omitempty"`
	AttackDelta       int          `json:"attackDelta,omitempty"`
	BlockDelta        int          `json:"blockDelta,omitempty"`
	ParryDelta        int          `json:"parryDelta,omitempty"`
	MaxAttentionDelta int          `json:"maxAttentionDelta,omitempty"`
	NoiseDelta        int          `json:"noiseDelta,omitempty"`
	DiscardAttention  int          `json:"discardAttention,omitempty"`
}

type StatEffect struct {
	Stat        string `json:"stat"`
	Amount      int    `json:"amount"`
	Description string `json:"description"`
}

type RewardState struct {
	EnemyID             string        `json:"enemyId"`
	EnemyName           string        `json:"enemyName"`
	Phase               string        `json:"phase"`
	ExploitOptions      []*Exploit    `json:"exploitOptions"`
	SelectedExploitID   string        `json:"selectedExploitId,omitempty"`
	ItemRewards         []*RewardItem `json:"itemRewards"`
	CurrentItemIndex    int           `json:"currentItemIndex"`
	DiscardAttentionSum int           `json:"discardAttentionSum"`
}

type RewardItem struct {
	Item     *Item  `json:"item"`
	Decision string `json:"decision,omitempty"`
}

func NewGameState(sessionID string) *GameState {
	focusedReply := cloneExploitDefinition("focused_reply")
	deepScroll := cloneExploitDefinition("deep_scroll")

	state := &GameState{
		SessionID:       sessionID,
		Phase:           "feed",
		Score:           0,
		Attention:       100,
		MaxAttention:    100,
		Attack:          9,
		Block:           5,
		Parry:           4,
		Noise:           1,
		DefeatedEnemies: []string{},
		Exploits:        [4]*Exploit{focusedReply, deepScroll, nil, nil},
		Inventory:       []*Exploit{focusedReply, deepScroll},
		Items:           []*Item{},
		Progress:        &RunProgress{ExploitsCollected: 2},
	}

	recalculateDerivedStats(state)
	return state
}
