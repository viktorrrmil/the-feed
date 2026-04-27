package game

import "math/rand"

func DecideEnemyAbility(state *GameState, rng *rand.Rand) EnemyAbility {
	combat := state.Combat
	if combat == nil || combat.Enemy == nil || len(combat.Enemy.Abilities) == 0 {
		return EnemyAbility{ID: "basic_attack", Name: "Basic Attack", DamageMin: 8, DamageMax: 12}
	}

	enemy := combat.Enemy
	switch enemy.ID {
	case "top_b":
		hpRatio := float64(combat.EnemyHP) / float64(max(enemy.MaxHP, 1))
		if hpRatio < 0.5 {
			if ability, ok := findAbility(enemy, "value_injection"); ok {
				return ability
			}
		}
		if rollWeighted(rng, 65) {
			if ability, ok := findAbility(enemy, "paywall"); ok {
				return ability
			}
		}
		if ability, ok := findAbility(enemy, "value_injection"); ok {
			return ability
		}
	case "kyle":
		hpRatio := float64(combat.EnemyHP) / float64(max(enemy.MaxHP, 1))
		if hpRatio < 0.35 && rollWeighted(rng, 40) {
			if ability, ok := findAbility(enemy, "hodl"); ok {
				return ability
			}
		}
		roll := rng.Intn(100)
		if roll < 40 {
			if ability, ok := findAbility(enemy, "pump"); ok {
				return ability
			}
		}
		if roll < 75 {
			if ability, ok := findAbility(enemy, "dump"); ok {
				return ability
			}
		}
		if ability, ok := findAbility(enemy, "hodl"); ok {
			return ability
		}
	case "michael":
		if combat.LastPlayerExploit != "" {
			if ability, ok := findAbility(enemy, "copy_exploit"); ok {
				return ability
			}
		}
		if ability, ok := findAbility(enemy, "resell_cycle"); ok {
			return ability
		}
	case "mr_least":
		if combat.PlayerBlockStreak >= 2 {
			if ability, ok := findAbility(enemy, "engagement_spike"); ok {
				return ability
			}
		}
		if rollWeighted(rng, 55) {
			if ability, ok := findAbility(enemy, "clickbait_loop"); ok {
				return ability
			}
		}
		if ability, ok := findAbility(enemy, "engagement_spike"); ok {
			return ability
		}
	case "arisloptle":
		return enemy.Abilities[rng.Intn(len(enemy.Abilities))]
	}

	return enemy.Abilities[rng.Intn(len(enemy.Abilities))]
}

func findAbility(enemy *Enemy, abilityID string) (EnemyAbility, bool) {
	for _, ability := range enemy.Abilities {
		if ability.ID == abilityID {
			return ability, true
		}
	}
	return EnemyAbility{}, false
}

func rollWeighted(rng *rand.Rand, threshold int) bool {
	return rng.Intn(100) < threshold
}
