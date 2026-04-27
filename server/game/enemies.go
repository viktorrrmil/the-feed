package game

var enemyDefinitions = map[string]*Enemy{
	"top_b": {
		ID:         "top_b",
		Name:       "Top B",
		MaxHP:      80,
		BaseAttack: 12,
		Abilities: []EnemyAbility{
			{ID: "paywall", Name: "Paywall", DamageMin: 10, DamageMax: 14, DisableExploitTurns: 1},
			{ID: "value_injection", Name: "Value Injection", DamageMin: 8, DamageMax: 12, SelfHeal: 8},
		},
		StealableExploit: &Exploit{ID: "growth_hack", Name: "Growth Hack", Kind: "damage"},
	},
	"kyle": {
		ID:         "kyle",
		Name:       "Kyle",
		MaxHP:      90,
		BaseAttack: 10,
		Abilities: []EnemyAbility{
			{ID: "pump", Name: "Pump", DamageMin: 14, DamageMax: 22, NoiseDelta: 1},
			{ID: "hodl", Name: "HODL", SelfHeal: 11},
			{ID: "dump", Name: "Dump", DamageMin: 6, DamageMax: 28, BypassBlock: true},
		},
		StealableExploit: &Exploit{ID: "volatility_engine", Name: "Volatility Engine", Kind: "damage"},
	},
	"michael": {
		ID:         "michael",
		Name:       "Michael",
		MaxHP:      75,
		BaseAttack: 10,
		Abilities: []EnemyAbility{
			{ID: "resell_cycle", Name: "Resell Cycle", DamageMin: 9, DamageMax: 13},
			{ID: "copy_exploit", Name: "Copy Exploit", DamageMin: 11, DamageMax: 17},
		},
	},
	"mr_least": {
		ID:         "mr_least",
		Name:       "Mr. Least",
		MaxHP:      85,
		BaseAttack: 14,
		Abilities: []EnemyAbility{
			{ID: "engagement_spike", Name: "Engagement Spike", DamageMin: 16, DamageMax: 24, BypassBlock: true},
			{ID: "clickbait_loop", Name: "Clickbait Loop", DamageMin: 11, DamageMax: 16, DisableExploitTurns: 1},
		},
		StealableExploit: &Exploit{ID: "bait_loop", Name: "Bait Loop", Kind: "utility"},
	},
	"arisloptle": {
		ID:         "arisloptle",
		Name:       "Arisloptle",
		MaxHP:      100,
		BaseAttack: 9,
		Abilities: []EnemyAbility{
			{ID: "interpretation_drift", Name: "Interpretation Drift", DamageMin: 7, DamageMax: 18, NoiseDelta: 1},
			{ID: "thesis_whiplash", Name: "Thesis Whiplash", DamageMin: 9, DamageMax: 20, IgnoreParry: true},
			{ID: "dialectic_pause", Name: "Dialectic Pause", SelfHeal: 12},
		},
	},
}

func EnemyByID(enemyID string) (*Enemy, bool) {
	enemy, ok := enemyDefinitions[enemyID]
	if !ok {
		return nil, false
	}

	cloned := *enemy
	cloned.Abilities = append([]EnemyAbility(nil), enemy.Abilities...)
	if enemy.StealableExploit != nil {
		exploitCloned := *enemy.StealableExploit
		cloned.StealableExploit = &exploitCloned
	}
	return &cloned, true
}
