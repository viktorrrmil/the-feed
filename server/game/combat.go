package game

import (
	"fmt"
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
		TurnPhase:        "player_select",
		TurnCount:        1,
		EnemyDebuffs:     map[string]int{},
		PlayerDebuffs:    map[string]int{},
		DisabledExploits: map[string]int{},
		PlayerCooldowns:  map[string]int{},
		EnemyCooldowns:   map[string]int{},
		Log:              []TurnResult{},
	}

	return enemy, nil
}

const (
	actionAttack  = "attack"
	actionBlock   = "block"
	actionParry   = "parry"
	actionExploit = "exploit"
	actionIdle    = "idle"
)

func ProcessCombatTurn(state *GameState, action PlayerAction, rng *rand.Rand) (*TurnResult, string, error) {
	enemyAction, err := PreviewEnemyCombatAction(state, action, rng)
	if err != nil {
		return nil, "", err
	}
	return ProcessCombatTurnWithEnemyAction(state, action, enemyAction, rng)
}

func PreviewEnemyCombatAction(state *GameState, playerAction PlayerAction, rng *rand.Rand) (*CombatAction, error) {
	if state.Phase != "combat" || state.Combat == nil {
		return nil, fmt.Errorf("combat action is unavailable in phase %s", state.Phase)
	}
	if state.Combat.Turn != "player" {
		return nil, fmt.Errorf("combat turn is currently %s", state.Combat.Turn)
	}
	playerCombatAction, err := buildPlayerCombatAction(state, playerAction, rng)
	if err != nil {
		return nil, err
	}
	state.Combat.PendingPlayerAction = &playerCombatAction
	enemyAction := decideEnemyAction(state, playerAction, rng)
	state.Combat.PendingEnemyAction = &enemyAction
	return &enemyAction, nil
}

func ProcessCombatTurnWithEnemyAction(
	state *GameState,
	playerSelection PlayerAction,
	enemySelection *CombatAction,
	rng *rand.Rand,
) (*TurnResult, string, error) {
	if state.Phase != "combat" || state.Combat == nil {
		return nil, "", fmt.Errorf("combat action is unavailable in phase %s", state.Phase)
	}
	if state.Combat.Turn != "player" {
		return nil, "", fmt.Errorf("combat turn is currently %s", state.Combat.Turn)
	}
	combat := state.Combat

	playerAction, err := buildPlayerCombatAction(state, playerSelection, rng)
	if err != nil {
		return nil, "", err
	}
	var enemyAction CombatAction
	if enemySelection != nil {
		enemyAction = *enemySelection
	} else {
		enemyAction = decideEnemyAction(state, playerSelection, rng)
	}
	combat.PendingEnemyAction = nil
	combat.PendingPlayerAction = nil

	turnResult := resolveSymmetricTurn(state, playerAction, enemyAction)
	advanceStatusEffects(state)
	advanceCooldowns(combat.PlayerCooldowns)
	advanceCooldowns(combat.EnemyCooldowns)
	applyActionCooldown(combat.PlayerCooldowns, playerAction)
	applyActionCooldown(combat.EnemyCooldowns, enemyAction)
	combat.LastEnemyAction = enemyAction.Type
	combat.LastEnemyActionValue = enemyAction.Value
	combat.LastEnemyActionCost = enemyAction.Cost

	_, result := CheckCombatEnd(state)

	if state.Combat != nil {
		if state.Phase == "combat" {
			state.Combat.Turn = "player"
			state.Combat.TurnPhase = "player_select"
			state.Combat.TurnCount++
		}
		state.Combat.Log = append(state.Combat.Log, *turnResult)
	}

	return turnResult, result, nil
}

func buildPlayerCombatAction(state *GameState, action PlayerAction, rng *rand.Rand) (CombatAction, error) {
	combat := state.Combat
	if combat == nil {
		return CombatAction{}, fmt.Errorf("combat state is unavailable")
	}

	switch action.Action {
	case actionAttack:
		if combat.PlayerCooldowns[actionAttack] > 0 {
			return CombatAction{}, fmt.Errorf("attack is on cooldown")
		}
		return CombatAction{Type: actionAttack, Label: "Attack", Cost: 9, Value: state.Attack}, nil
	case actionBlock:
		if combat.PlayerCooldowns[actionBlock] > 0 {
			return CombatAction{}, fmt.Errorf("block is on cooldown")
		}
		return CombatAction{Type: actionBlock, Label: "Block", Cost: 5, Value: state.Block}, nil
	case actionParry:
		if combat.PlayerCooldowns[actionParry] > 0 {
			return CombatAction{}, fmt.Errorf("parry is on cooldown")
		}
		return CombatAction{Type: actionParry, Label: "Parry", Cost: 4, Value: state.Parry}, nil
	case actionExploit:
		exploit := findEquippedExploit(state, action.ExploitID)
		if exploit == nil {
			return CombatAction{}, fmt.Errorf("exploit %q is not equipped", action.ExploitID)
		}
		if combat.PlayerCooldowns[exploit.ID] > 0 {
			return CombatAction{}, fmt.Errorf("exploit %q is on cooldown", exploit.ID)
		}
		if state.Combat.DisabledExploits[exploit.ID] > 0 {
			return CombatAction{}, fmt.Errorf("exploit %q is currently disabled", exploit.ID)
		}
		return CombatAction{
			Type:      actionExploit,
			Label:     exploit.Name,
			Cost:      8,
			Value:     exploitDamageValue(exploit.ID, state.Noise, rng),
			ExploitID: exploit.ID,
		}, nil
	default:
		return CombatAction{}, fmt.Errorf("unsupported combat action %q", action.Action)
	}
}

func decideEnemyAction(state *GameState, playerSelection PlayerAction, rng *rand.Rand) CombatAction {
	combat := state.Combat
	if combat == nil || combat.Enemy == nil {
		return CombatAction{Type: actionIdle, Label: "Idle", Cost: 0, Value: 0}
	}
	enemyAT := combat.EnemyHP
	candidates := make([]CombatAction, 0, 4)
	pushIfAffordable := func(action CombatAction) {
		cooldownKey := cooldownKeyForAction(action)
		if enemyAT >= action.Cost && combat.EnemyCooldowns[cooldownKey] == 0 {
			candidates = append(candidates, action)
		}
	}
	pushIfAffordable(CombatAction{Type: actionAttack, Label: "Attack", Cost: 9, Value: 9})
	pushIfAffordable(CombatAction{Type: actionBlock, Label: "Block", Cost: 5, Value: 5})
	pushIfAffordable(CombatAction{Type: actionParry, Label: "Parry", Cost: 4, Value: 4})
	pushIfAffordable(CombatAction{
		Type:  actionExploit,
		Label: "Exploit",
		Cost:  8,
		Value: 7 + combat.Enemy.BaseAttack/2,
	})
	if len(candidates) == 0 {
		return CombatAction{Type: actionIdle, Label: "Idle", Cost: 0, Value: 0}
	}

	playerType := playerSelection.Action
	if playerType == actionAttack || playerType == actionExploit {
		roll := rng.Intn(100)
		for _, action := range candidates {
			if action.Type == actionParry && roll < 35 {
				return action
			}
		}
		for _, action := range candidates {
			if action.Type == actionBlock && roll < 70 {
				return action
			}
		}
		for _, action := range candidates {
			if action.Type == actionAttack {
				return action
			}
		}
	}
	if enemyAT <= combat.Enemy.MaxHP/3 {
		for _, action := range candidates {
			if action.Type == actionBlock {
				return action
			}
		}
		for _, action := range candidates {
			if action.Type == actionParry {
				return action
			}
		}
	}
	return candidates[rng.Intn(len(candidates))]
}

func exploitDamageValue(exploitID string, noise int, rng *rand.Rand) int {
	switch exploitID {
	case "focused_reply":
		return 11 + noise
	case "deep_scroll":
		return 9 + noise
	case "growth_hack":
		return 8 + noise + rng.Intn(4)
	case "volatility_engine":
		return 6 + noise + rng.Intn(8)
	case "bait_loop":
		return 10 + noise
	case "paywall_puncture":
		return 12 + noise
	case "value_injection":
		return 10 + noise + rng.Intn(3)
	case "pump_cycle":
		return 9 + noise + rng.Intn(5)
	case "dump_route":
		return 13 + noise
	case "copycat_kernel":
		return 10 + noise
	case "resell_cycle":
		return 11 + noise
	case "engagement_spike":
		return 14 + noise
	case "clickbait_loop":
		return 11 + noise + rng.Intn(3)
	case "interpretation_drift":
		return 10 + noise + rng.Intn(5)
	case "thesis_whiplash":
		return 12 + noise + rng.Intn(4)
	default:
		return 9 + noise
	}
}

func resolveSymmetricTurn(state *GameState, playerAction CombatAction, enemyAction CombatAction) *TurnResult {
	combat := state.Combat
	result := &TurnResult{
		PlayerAction:      playerAction.Label,
		EnemyAction:       enemyAction.Label,
		PlayerActionCost:  playerAction.Cost,
		EnemyActionCost:   enemyAction.Cost,
		PlayerActionValue: playerAction.Value,
		EnemyActionValue:  enemyAction.Value,
		Effects:           []TurnEffect{},
	}
	combat.PlayerBlock = playerAction.Type == actionBlock
	combat.PlayerParry = playerAction.Type == actionParry
	combat.EnemyBlock = enemyAction.Type == actionBlock
	combat.EnemyParry = enemyAction.Type == actionParry
	result.PlayerState = stateLabel(combat.PlayerBlock, combat.PlayerParry)
	result.EnemyState = stateLabel(combat.EnemyBlock, combat.EnemyParry)

	spendPlayer := min(playerAction.Cost, state.Attention)
	spendEnemy := min(enemyAction.Cost, combat.EnemyHP)
	state.Attention = max(state.Attention-spendPlayer, 0)
	combat.EnemyHP = max(combat.EnemyHP-spendEnemy, 0)
	result.PlayerATSpent = spendPlayer
	result.EnemyATSpent = spendEnemy
	result.Effects = append(result.Effects,
		TurnEffect{Target: "player", Kind: "cost", Amount: spendPlayer, Label: fmt.Sprintf("Player spent %d AT", spendPlayer)},
		TurnEffect{Target: "enemy", Kind: "cost", Amount: spendEnemy, Label: fmt.Sprintf("Enemy spent %d AT", spendEnemy)},
	)

	playerDamage, playerRefund, playerPenalty, playerLabels := resolveOffense(playerAction, enemyAction)
	enemyDamage, enemyRefund, enemyPenalty, enemyLabels := resolveOffense(enemyAction, playerAction)

	for _, label := range playerLabels {
		result.Effects = append(result.Effects, TurnEffect{Target: "enemy", Kind: "resolve", Amount: playerDamage, Label: label})
	}
	for _, label := range enemyLabels {
		result.Effects = append(result.Effects, TurnEffect{Target: "player", Kind: "resolve", Amount: enemyDamage, Label: label})
	}

	if playerDamage > 0 {
		combat.EnemyHP = max(combat.EnemyHP-playerDamage, 0)
	}
	if enemyDamage > 0 {
		state.Attention = max(state.Attention-enemyDamage, 0)
	}
	state.Attention = min(state.Attention+playerRefund, state.MaxAttention)
	combat.EnemyHP = min(combat.EnemyHP+enemyRefund, combat.Enemy.MaxHP)
	state.Attention = max(state.Attention-playerPenalty, 0)
	combat.EnemyHP = max(combat.EnemyHP-enemyPenalty, 0)

	result.PlayerDamage = playerDamage
	result.EnemyDamage = enemyDamage
	result.PlayerATRefund = playerRefund
	result.EnemyATRefund = enemyRefund
	result.PlayerPenaltyAT = playerPenalty
	result.EnemyPenaltyAT = enemyPenalty
	result.EnemyHP = combat.EnemyHP
	result.EnemyAttention = combat.EnemyHP
	result.PlayerAttention = state.Attention

	return result
}

func resolveOffense(attacker CombatAction, defender CombatAction) (damage int, refund int, penalty int, labels []string) {
	if attacker.Type != actionAttack && attacker.Type != actionExploit {
		return 0, 0, 0, []string{fmt.Sprintf("%s held position", attacker.Label)}
	}
	attackValue := attacker.Value
	switch defender.Type {
	case actionBlock:
		damage = max(attackValue-defender.Value, 0)
		refund = damage
		if damage == 0 {
			return 0, 0, 0, []string{fmt.Sprintf("%s fully blocked (%d)", attacker.Label, defender.Value)}
		}
		return damage, refund, 0, []string{fmt.Sprintf("%s through block for %d", attacker.Label, damage)}
	case actionParry:
		if defender.Value >= attackValue {
			penalty = attackValue
			return 0, 0, penalty, []string{fmt.Sprintf("%s reflected by parry for %d", attacker.Label, penalty)}
		}
		damage = attackValue
		refund = damage
		return damage, refund, 0, []string{fmt.Sprintf("%s beat parry and landed for %d", attacker.Label, damage)}
	default:
		damage = attackValue
		refund = damage
		return damage, refund, 0, []string{fmt.Sprintf("%s landed for %d", attacker.Label, damage)}
	}
}

func stateLabel(isBlock bool, isParry bool) string {
	if isBlock {
		return "block"
	}
	if isParry {
		return "parry"
	}
	return "none"
}

func CheckCombatEnd(state *GameState) (bool, string) {
	combat := state.Combat
	if combat == nil {
		return false, ""
	}

	if state.Attention <= 0 {
		state.Phase = "game_over"
		state.Outcome = "defeat"
		state.Combat = nil
		return true, "lose"
	}

	if combat.EnemyHP > 0 {
		return false, ""
	}

	if !containsString(state.DefeatedEnemies, combat.Enemy.ID) {
		state.DefeatedEnemies = append(state.DefeatedEnemies, combat.Enemy.ID)
	}
	state.Progress.CombatsWon++
	state.Score += 20
	state.Phase = "combat_resolved"
	state.Outcome = ""
	state.Reward = buildRewardState(combat.Enemy, state, NewCombatRNG())
	state.Combat.Turn = "resolved"
	state.Combat.TurnPhase = "resolved"
	state.Combat.PendingEnemyAction = nil
	state.Combat.PendingPlayerAction = nil
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

func advanceCooldowns(cooldowns map[string]int) {
	for key, turns := range cooldowns {
		if turns <= 1 {
			delete(cooldowns, key)
			continue
		}
		cooldowns[key] = turns - 1
	}
}

func applyActionCooldown(cooldowns map[string]int, action CombatAction) {
	key := cooldownKeyForAction(action)
	if key == "" {
		return
	}
	if action.Type == actionExploit {
		cooldowns[key] = 2
		return
	}
	cooldowns[key] = 1
}

func cooldownKeyForAction(action CombatAction) string {
	if action.Type == actionExploit {
		if action.ExploitID == "" {
			return "enemy_exploit"
		}
		return action.ExploitID
	}
	return action.Type
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
