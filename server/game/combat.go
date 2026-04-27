package game

import (
	"fmt"
	"math"
	"math/rand"
	"time"
)

func StartCombat(state *GameState, enemyID string) (*Enemy, error) {
	if state.Phase != "feed" {
		return nil, fmt.Errorf("cannot start combat in phase %s", state.Phase)
	}

	enemy, ok := EnemyByID(enemyID)
	if !ok {
		return nil, fmt.Errorf("unknown enemy %q", enemyID)
	}

	state.Phase = "combat"
	state.Combat = &CombatState{
		Enemy:            enemy,
		EnemyHP:          enemy.MaxHP,
		Turn:             "player",
		TurnCount:        1,
		EnemyDebuffs:     map[string]int{},
		PlayerDebuffs:    map[string]int{},
		DisabledExploits: map[string]int{},
		Log:              []TurnResult{},
	}

	return enemy, nil
}

func ProcessCombatTurn(state *GameState, action PlayerAction, rng *rand.Rand) (*TurnResult, string, error) {
	if state.Phase != "combat" || state.Combat == nil {
		return nil, "", fmt.Errorf("combat action is unavailable in phase %s", state.Phase)
	}
	if state.Combat.Turn != "player" {
		return nil, "", fmt.Errorf("combat turn is currently %s", state.Combat.Turn)
	}

	advanceStatusEffects(state)

	turnResult, err := ProcessPlayerAction(state, action, rng)
	if err != nil {
		return nil, "", err
	}

	ended, result := CheckCombatEnd(state)
	if !ended {
		state.Combat.Turn = "enemy"
		ProcessEnemyTurn(state, turnResult, rng)
		ended, result = CheckCombatEnd(state)
	}

	if state.Phase == "combat" && state.Combat != nil {
		state.Combat.Turn = "player"
		state.Combat.TurnCount++
		state.Combat.PlayerBlock = false
		state.Combat.PlayerParry = false
		state.Combat.Log = append(state.Combat.Log, *turnResult)
	}

	return turnResult, result, nil
}

func ProcessPlayerAction(state *GameState, action PlayerAction, rng *rand.Rand) (*TurnResult, error) {
	combat := state.Combat
	if combat == nil {
		return nil, fmt.Errorf("combat state is missing")
	}

	result := &TurnResult{
		PlayerAction:    action.Action,
		EnemyAction:     "",
		PlayerDamage:    0,
		EnemyDamage:     0,
		EnemyHP:         combat.EnemyHP,
		PlayerAttention: state.Attention,
		Effects:         []TurnEffect{},
	}

	switch action.Action {
	case "attack":
		damage := 12 + state.Noise*2 + rng.Intn(4)
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage = damage
		result.EnemyHP = combat.EnemyHP
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  "Direct hit",
		})
		combat.PlayerBlockStreak = 0
	case "block":
		combat.PlayerBlock = true
		combat.PlayerParry = false
		combat.PlayerBlockStreak++
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "guard",
			Amount: 0,
			Label:  "Brace",
		})
	case "parry":
		combat.PlayerParry = true
		combat.PlayerBlock = false
		combat.PlayerBlockStreak = 0
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "parry",
			Amount: 0,
			Label:  "Counter stance",
		})
	case "exploit":
		exploit := findEquippedExploit(state, action.ExploitID)
		if exploit == nil {
			return nil, fmt.Errorf("exploit %q is not equipped", action.ExploitID)
		}
		if combat.DisabledExploits[exploit.ID] > 0 {
			return nil, fmt.Errorf("exploit %q is currently disabled", exploit.ID)
		}
		applyPlayerExploit(state, exploit, result, rng)
		combat.LastPlayerExploit = exploit.ID
		combat.PlayerBlockStreak = 0
	default:
		return nil, fmt.Errorf("unsupported combat action %q", action.Action)
	}

	return result, nil
}

func ProcessEnemyTurn(state *GameState, result *TurnResult, rng *rand.Rand) {
	combat := state.Combat
	if combat == nil {
		return
	}

	ability := DecideEnemyAbility(state, rng)
	baseDamage := rollDamage(ability, combat.Enemy.BaseAttack, rng)
	finalDamage := baseDamage
	parried := false

	if combat.PlayerParry && !ability.IgnoreParry {
		parried = true
		finalDamage = 0
		parryDamage := 8 + state.Noise
		combat.EnemyHP = max(combat.EnemyHP-parryDamage, 0)
		result.PlayerDamage += parryDamage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: parryDamage,
			Label:  "Parry return",
		})
	} else if combat.PlayerBlock && !ability.BypassBlock {
		finalDamage = int(math.Max(1, float64(baseDamage/2)))
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "block",
			Amount: baseDamage - finalDamage,
			Label:  "Blocked",
		})
	}

	if finalDamage > 0 {
		state.Attention = max(state.Attention-finalDamage, 0)
		result.EnemyDamage = finalDamage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "damage",
			Amount: finalDamage,
			Label:  "Enemy strike",
		})
	}

	if ability.SelfHeal > 0 {
		combat.EnemyHP = min(combat.EnemyHP+ability.SelfHeal, combat.Enemy.MaxHP)
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "heal",
			Amount: ability.SelfHeal,
			Label:  "Enemy recovers",
		})
	}

	if ability.DisableExploitTurns > 0 {
		if disabled := pickRandomEquippedExploitID(state, rng); disabled != "" {
			combat.DisabledExploits[disabled] = ability.DisableExploitTurns
			result.Effects = append(result.Effects, TurnEffect{
				Target: "player",
				Kind:   "disable",
				Amount: ability.DisableExploitTurns,
				Label:  fmt.Sprintf("%s disabled", disabled),
			})
		}
	}

	if ability.NoiseDelta != 0 {
		state.Noise = clamp(state.Noise+ability.NoiseDelta, 1, 9)
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "noise",
			Amount: ability.NoiseDelta,
			Label:  "Noise shifted",
		})
	}

	result.EnemyAction = ability.Name
	if parried {
		result.EnemyAction = ability.Name + " (parried)"
	}
	combat.LastEnemyAction = ability.ID
	result.EnemyHP = combat.EnemyHP
	result.PlayerAttention = state.Attention
}

func CheckCombatEnd(state *GameState) (bool, string) {
	combat := state.Combat
	if combat == nil {
		return false, ""
	}

	if state.Attention <= 0 {
		state.Phase = "game_over"
		state.Combat = nil
		return true, "lose"
	}

	if combat.EnemyHP > 0 {
		return false, ""
	}

	if !containsString(state.DefeatedEnemies, combat.Enemy.ID) {
		state.DefeatedEnemies = append(state.DefeatedEnemies, combat.Enemy.ID)
	}
	if combat.Enemy.StealableExploit != nil && !containsExploit(state.Inventory, combat.Enemy.StealableExploit.ID) {
		lootExploit := *combat.Enemy.StealableExploit
		state.Inventory = append(state.Inventory, &lootExploit)
	}
	state.Score += 20
	state.Phase = "feed"
	state.Combat = nil
	return true, "win"
}

func advanceStatusEffects(state *GameState) {
	if state.Combat == nil {
		return
	}
	for exploitID, turns := range state.Combat.DisabledExploits {
		if turns <= 1 {
			delete(state.Combat.DisabledExploits, exploitID)
			continue
		}
		state.Combat.DisabledExploits[exploitID] = turns - 1
	}
}

func applyPlayerExploit(state *GameState, exploit *Exploit, result *TurnResult, rng *rand.Rand) {
	combat := state.Combat
	if combat == nil {
		return
	}

	switch exploit.ID {
	case "focused_reply":
		damage := 18 + state.Noise*2
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage += damage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  "Focused Reply",
		})
	case "deep_scroll":
		heal := 14 + state.Noise
		state.Attention = min(state.Attention+heal, state.MaxAttention)
		result.Effects = append(result.Effects, TurnEffect{
			Target: "player",
			Kind:   "heal",
			Amount: heal,
			Label:  "Deep Scroll",
		})
	case "growth_hack":
		damage := (10 + rng.Intn(6)) * state.Noise
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage += damage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  "Growth Hack",
		})
	case "volatility_engine":
		multiplier := 0.5 + rng.Float64()*2
		damage := int(float64(12+state.Noise*2) * multiplier)
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage += damage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  "Volatility Engine",
		})
	case "bait_loop":
		damage := 15 + state.Noise
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage += damage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  "Bait Loop",
		})
	default:
		damage := 10 + state.Noise
		combat.EnemyHP = max(combat.EnemyHP-damage, 0)
		result.PlayerDamage += damage
		result.Effects = append(result.Effects, TurnEffect{
			Target: "enemy",
			Kind:   "damage",
			Amount: damage,
			Label:  exploit.Name,
		})
	}

	result.EnemyHP = combat.EnemyHP
	result.PlayerAttention = state.Attention
}

func findEquippedExploit(state *GameState, exploitID string) *Exploit {
	for _, exploit := range state.Exploits {
		if exploit != nil && exploit.ID == exploitID {
			return exploit
		}
	}
	return nil
}

func pickRandomEquippedExploitID(state *GameState, rng *rand.Rand) string {
	ids := make([]string, 0, len(state.Exploits))
	for _, exploit := range state.Exploits {
		if exploit != nil {
			ids = append(ids, exploit.ID)
		}
	}
	if len(ids) == 0 {
		return ""
	}
	return ids[rng.Intn(len(ids))]
}

func rollDamage(ability EnemyAbility, fallback int, rng *rand.Rand) int {
	minDamage := ability.DamageMin
	maxDamage := ability.DamageMax
	if maxDamage <= 0 {
		minDamage = max(4, fallback-2)
		maxDamage = fallback + 4
	}
	if maxDamage < minDamage {
		maxDamage = minDamage
	}
	if maxDamage == minDamage {
		return minDamage
	}
	return minDamage + rng.Intn(maxDamage-minDamage+1)
}

func containsString(list []string, needle string) bool {
	for _, value := range list {
		if value == needle {
			return true
		}
	}
	return false
}

func containsExploit(list []*Exploit, exploitID string) bool {
	for _, exploit := range list {
		if exploit != nil && exploit.ID == exploitID {
			return true
		}
	}
	return false
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func NewCombatRNG() *rand.Rand {
	return rand.New(rand.NewSource(time.Now().UnixNano()))
}
