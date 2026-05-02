package game

import (
	"fmt"
	"math/rand"
)

const (
	baseAttackValue = 9
	baseBlockValue  = 5
	baseParryValue  = 4
	baseMaxAT       = 100
)

type enemyRewardProfile struct {
	ExploitOptionIDs []string
	ItemPoolIDs      []string
}

type itemTemplate struct {
	ID                string
	Name              string
	Description       string
	Image             string
	Effects           []StatEffect
	AttackDelta       int
	BlockDelta        int
	ParryDelta        int
	MaxAttentionDelta int
	NoiseDelta        int
	DiscardAttention  int
}

var exploitDefinitions = map[string]Exploit{
	"focused_reply": {
		ID:          "focused_reply",
		Name:        "Focused Reply",
		Kind:        "damage",
		Description: "A precise clapback that scales with your current noise.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 11, Description: "Deals 11 + Noise damage."},
		},
	},
	"deep_scroll": {
		ID:          "deep_scroll",
		Name:        "Deep Scroll",
		Kind:        "utility",
		Description: "A quiet, measured exploit that keeps pressure steady.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 9, Description: "Deals 9 + Noise damage."},
		},
	},
	"growth_hack": {
		ID:          "growth_hack",
		Name:        "Growth Hack",
		Kind:        "damage",
		Description: "Unstable burst damage with a strong upside.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 8, Description: "Deals 8-11 + Noise damage."},
		},
	},
	"volatility_engine": {
		ID:          "volatility_engine",
		Name:        "Volatility Engine",
		Kind:        "damage",
		Description: "Big variance, big swing turns, stronger when the run gets loud.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 6, Description: "Deals 6-13 + Noise damage."},
		},
	},
	"bait_loop": {
		ID:          "bait_loop",
		Name:        "Bait Loop",
		Kind:        "utility",
		Description: "A taunting loop that converts chaos into pressure.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 10, Description: "Deals 10 + Noise damage."},
		},
	},
	"paywall_puncture": {
		ID:          "paywall_puncture",
		Name:        "Paywall Puncture",
		Kind:        "damage",
		Description: "Pierces through soft defenses with a cleaner hit.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 12, Description: "Deals 12 + Noise damage."},
		},
	},
	"value_injection": {
		ID:          "value_injection",
		Name:        "Value Injection",
		Kind:        "damage",
		Description: "A packaged strike tuned for stable output.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 10, Description: "Deals 10-12 + Noise damage."},
		},
	},
	"pump_cycle": {
		ID:          "pump_cycle",
		Name:        "Pump Cycle",
		Kind:        "damage",
		Description: "Momentum-based exploit that spikes hard under pressure.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 9, Description: "Deals 9-13 + Noise damage."},
		},
	},
	"dump_route": {
		ID:          "dump_route",
		Name:        "Dump Route",
		Kind:        "damage",
		Description: "Front-loads impact before the timeline can answer back.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 13, Description: "Deals 13 + Noise damage."},
		},
	},
	"copycat_kernel": {
		ID:          "copycat_kernel",
		Name:        "Copycat Kernel",
		Kind:        "utility",
		Description: "Mirrors the safest parts of a winning pattern.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 10, Description: "Deals 10 + Noise damage."},
		},
	},
	"resell_cycle": {
		ID:          "resell_cycle",
		Name:        "Resell Cycle",
		Kind:        "damage",
		Description: "Keeps value moving with a repeatable trading rhythm.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 11, Description: "Deals 11 + Noise damage."},
		},
	},
	"engagement_spike": {
		ID:          "engagement_spike",
		Name:        "Engagement Spike",
		Kind:        "damage",
		Description: "A sharp burst meant to overwhelm the pace of a fight.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 14, Description: "Deals 14 + Noise damage."},
		},
	},
	"clickbait_loop": {
		ID:          "clickbait_loop",
		Name:        "Clickbait Loop",
		Kind:        "utility",
		Description: "Converts attention drag into repeatable offensive pressure.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 11, Description: "Deals 11-13 + Noise damage."},
		},
	},
	"interpretation_drift": {
		ID:          "interpretation_drift",
		Name:        "Interpretation Drift",
		Kind:        "utility",
		Description: "Spreads ambiguity until the opponent takes the wrong line.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 10, Description: "Deals 10-14 + Noise damage."},
		},
	},
	"thesis_whiplash": {
		ID:          "thesis_whiplash",
		Name:        "Thesis Whiplash",
		Kind:        "damage",
		Description: "A heavy turnaround that lands hardest in noisy states.",
		Effects: []StatEffect{
			{Stat: "damage", Amount: 12, Description: "Deals 12-15 + Noise damage."},
		},
	},
}

var itemTemplates = map[string]itemTemplate{
	"focus_tonic": {
		ID:          "focus_tonic",
		Name:        "Focus Tonic",
		Description: "A clean hit of clarity that broadens your AT pool.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "AT", Amount: 12, Description: "+12 max AT."},
		},
		MaxAttentionDelta: 12,
		DiscardAttention:  10,
	},
	"impact_serum": {
		ID:          "impact_serum",
		Name:        "Impact Serum",
		Description: "Turns every basic hit into a sharper threat.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "attack", Amount: 3, Description: "+3 Attack."},
		},
		AttackDelta:      3,
		DiscardAttention: 8,
	},
	"guard_patch": {
		ID:          "guard_patch",
		Name:        "Guard Patch",
		Description: "Shifts your stance toward safer exchanges.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "block", Amount: 2, Description: "+2 Block."},
		},
		BlockDelta:       2,
		DiscardAttention: 8,
	},
	"counter_tonic": {
		ID:          "counter_tonic",
		Name:        "Counter Tonic",
		Description: "Refines your timing for cleaner parries.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "parry", Amount: 2, Description: "+2 Parry."},
		},
		ParryDelta:       2,
		DiscardAttention: 8,
	},
	"static_filter": {
		ID:          "static_filter",
		Name:        "Static Filter",
		Description: "Cuts through feed noise and stabilizes exploit output.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "noise", Amount: -1, Description: "-1 Noise, minimum 1."},
		},
		NoiseDelta:       -1,
		DiscardAttention: 9,
	},
	"overclock_mix": {
		ID:          "overclock_mix",
		Name:        "Overclock Mix",
		Description: "More power now, at the cost of a louder profile.",
		Image:       "/potion.png",
		Effects: []StatEffect{
			{Stat: "attack", Amount: 2, Description: "+2 Attack."},
			{Stat: "noise", Amount: 1, Description: "+1 Noise."},
		},
		AttackDelta:      2,
		NoiseDelta:       1,
		DiscardAttention: 11,
	},
}

var enemyRewardProfiles = map[string]enemyRewardProfile{
	"top_b": {
		ExploitOptionIDs: []string{"growth_hack", "paywall_puncture"},
		ItemPoolIDs:      []string{"focus_tonic", "guard_patch", "static_filter"},
	},
	"kyle": {
		ExploitOptionIDs: []string{"volatility_engine", "pump_cycle"},
		ItemPoolIDs:      []string{"impact_serum", "overclock_mix", "focus_tonic"},
	},
	"michael": {
		ExploitOptionIDs: []string{"copycat_kernel", "resell_cycle"},
		ItemPoolIDs:      []string{"counter_tonic", "focus_tonic", "static_filter"},
	},
	"mr_least": {
		ExploitOptionIDs: []string{"bait_loop", "engagement_spike"},
		ItemPoolIDs:      []string{"impact_serum", "guard_patch", "overclock_mix"},
	},
	"arisloptle": {
		ExploitOptionIDs: []string{"interpretation_drift", "thesis_whiplash"},
		ItemPoolIDs:      []string{"counter_tonic", "static_filter", "focus_tonic"},
	},
}

func cloneExploitDefinition(exploitID string) *Exploit {
	definition, ok := exploitDefinitions[exploitID]
	if !ok {
		return &Exploit{
			ID:          exploitID,
			Name:        exploitID,
			Kind:        "damage",
			Description: "A captured exploit from the timeline.",
		}
	}

	cloned := definition
	cloned.Effects = append([]StatEffect(nil), definition.Effects...)
	return &cloned
}

func instantiateItem(templateID string, instanceIndex int) *Item {
	template, ok := itemTemplates[templateID]
	if !ok {
		return nil
	}

	item := &Item{
		ID:                fmt.Sprintf("%s_%d", template.ID, instanceIndex),
		Name:              template.Name,
		Description:       template.Description,
		Image:             template.Image,
		Effects:           append([]StatEffect(nil), template.Effects...),
		AttackDelta:       template.AttackDelta,
		BlockDelta:        template.BlockDelta,
		ParryDelta:        template.ParryDelta,
		MaxAttentionDelta: template.MaxAttentionDelta,
		NoiseDelta:        template.NoiseDelta,
		DiscardAttention:  template.DiscardAttention,
	}
	return item
}

func recalculateDerivedStats(state *GameState) {
	if state == nil {
		return
	}

	attack := baseAttackValue
	block := baseBlockValue
	parry := baseParryValue
	maxAttention := baseMaxAT

	for _, item := range state.Items {
		if item == nil {
			continue
		}
		attack += item.AttackDelta
		block += item.BlockDelta
		parry += item.ParryDelta
		maxAttention += item.MaxAttentionDelta
	}

	state.Attack = max(attack, 1)
	state.Block = max(block, 1)
	state.Parry = max(parry, 1)
	state.MaxAttention = max(maxAttention, 1)
	state.Attention = clamp(state.Attention, 0, state.MaxAttention)
	state.Noise = max(state.Noise, 1)
}

func buildRewardState(enemy *Enemy, state *GameState, rng *rand.Rand) *RewardState {
	if enemy == nil {
		return &RewardState{
			Phase:          "complete",
			ExploitOptions: []*Exploit{},
			ItemRewards:    []*RewardItem{},
		}
	}

	profile := enemyRewardProfiles[enemy.ID]
	exploitOptions := make([]*Exploit, 0, len(profile.ExploitOptionIDs))
	for _, exploitID := range profile.ExploitOptionIDs {
		exploitOptions = append(exploitOptions, cloneExploitDefinition(exploitID))
	}

	itemRewards := rollRewardItems(profile.ItemPoolIDs, len(state.Items), rng)

	return &RewardState{
		EnemyID:        enemy.ID,
		EnemyName:      enemy.Name,
		Phase:          "exploit_choice",
		ExploitOptions: exploitOptions,
		ItemRewards:    itemRewards,
	}
}

func rollRewardItems(pool []string, inventorySize int, rng *rand.Rand) []*RewardItem {
	if len(pool) == 0 {
		return []*RewardItem{}
	}

	itemCount := rng.Intn(3)
	if itemCount == 0 {
		return []*RewardItem{}
	}

	rewards := make([]*RewardItem, 0, itemCount)
	for index := 0; index < itemCount; index++ {
		templateID := pool[rng.Intn(len(pool))]
		item := instantiateItem(templateID, inventorySize+index+1)
		if item == nil {
			continue
		}
		rewards = append(rewards, &RewardItem{Item: item})
	}

	return rewards
}

func applyKeptItem(state *GameState, item *Item) {
	if state == nil || item == nil {
		return
	}

	previousMaxAttention := state.MaxAttention
	state.Items = append(state.Items, item)
	recalculateDerivedStats(state)
	if state.MaxAttention > previousMaxAttention {
		state.Attention = min(state.Attention+(state.MaxAttention-previousMaxAttention), state.MaxAttention)
	}
	state.Noise = max(state.Noise+item.NoiseDelta, 1)
}
