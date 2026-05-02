package game

import (
	cryptorand "crypto/rand"
	"encoding/hex"
	"fmt"
	"math/rand"
	"sync"
)

type Session struct {
	ID    string
	State *GameState
	mu    sync.RWMutex
	feed  *FeedGenerator
	rng   *rand.Rand
	posts map[string]*feedPostState
}

type feedPostState struct {
	post      *FeedPost
	liked     bool
	advanced  bool
	atAwarded bool
}

var sessionStore = struct {
	sync.RWMutex
	sessions map[string]*Session
}{
	sessions: map[string]*Session{},
}

func CreateSession() (*Session, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:    sessionID,
		State: NewGameState(sessionID),
		feed:  NewFeedGenerator(),
		rng:   NewCombatRNG(),
		posts: map[string]*feedPostState{},
	}

	sessionStore.Lock()
	sessionStore.sessions[sessionID] = session
	sessionStore.Unlock()

	return session, nil
}

func GetSession(sessionID string) (*Session, bool) {
	sessionStore.RLock()
	session, ok := sessionStore.sessions[sessionID]
	sessionStore.RUnlock()
	return session, ok
}

func (s *Session) SnapshotState() *GameState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return cloneState(s.State)
}

func (s *Session) ScrollFeed() (*FeedPost, *Enemy, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase != "feed" {
		return nil, nil, nil, fmt.Errorf("cannot scroll when phase is %s", s.State.Phase)
	}

	post := s.feed.NextPost(s.State)
	s.posts[post.ID] = &feedPostState{post: cloneFeedPost(post)}
	var combatEnemy *Enemy
	if post.Type == PostTypeNormal {
		s.State.Score++
	} else if post.Type == PostTypeEvil {
		enemy, err := StartCombat(s.State, post.Content.EnemyID)
		if err != nil {
			return nil, nil, nil, err
		}
		combatEnemy = enemy
	}

	return post, combatEnemy, cloneState(s.State), nil
}

func (s *Session) AdvanceFeed(postID string) (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase != "feed" {
		return nil, fmt.Errorf("cannot advance feed in phase %s", s.State.Phase)
	}

	postState, ok := s.posts[postID]
	if !ok || postState.post == nil {
		return cloneState(s.State), nil
	}

	if postState.advanced {
		return cloneState(s.State), nil
	}

	postState.advanced = true
	if postState.post.Type == PostTypeNormal && postState.post.Content.IsOff && !postState.post.Content.IsTrap && !postState.liked && !postState.atAwarded {
		s.State.Attention = min(s.State.Attention+3, s.State.MaxAttention)
		postState.atAwarded = true
	}

	return cloneState(s.State), nil
}

func (s *Session) LikeFeedPost(postID string) (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase != "feed" {
		return nil, fmt.Errorf("cannot like post in phase %s", s.State.Phase)
	}

	postState, ok := s.posts[postID]
	if !ok || postState.post == nil {
		return cloneState(s.State), nil
	}
	if postState.liked {
		return cloneState(s.State), nil
	}

	postState.liked = true
	if postState.post.Type == PostTypeNormal && !postState.post.Content.IsOff && !postState.atAwarded {
		s.State.Attention = min(s.State.Attention+2, s.State.MaxAttention)
		postState.atAwarded = true
	}

	return cloneState(s.State), nil
}

func (s *Session) HandleCombatAction(action PlayerAction) (*TurnResult, string, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "resolving"
	}
	turn, combatResult, err := ProcessCombatTurn(s.State, action, s.rng)
	if err != nil {
		return nil, "", nil, err
	}

	return turn, combatResult, cloneState(s.State), nil
}

func (s *Session) PreviewEnemyAction(action PlayerAction) (*CombatAction, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "enemy_thinking"
	}
	preview, err := PreviewEnemyCombatAction(s.State, action, s.rng)
	if err != nil {
		return nil, nil, err
	}
	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "enemy_reveal"
	}
	return preview, cloneState(s.State), nil
}

func (s *Session) ResolveCombatAction(action PlayerAction, enemyAction *CombatAction) (*TurnResult, string, *GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Combat != nil {
		s.State.Combat.TurnPhase = "resolving"
	}
	turn, combatResult, err := ProcessCombatTurnWithEnemyAction(s.State, action, enemyAction, s.rng)
	if err != nil {
		return nil, "", nil, err
	}
	return turn, combatResult, cloneState(s.State), nil
}

func (s *Session) SelectRewardExploit(exploitID string) (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if (s.State.Phase != "combat_resolved" && s.State.Phase != "reward_selection") || s.State.Reward == nil {
		return nil, fmt.Errorf("reward selection is unavailable in phase %s", s.State.Phase)
	}
	if s.State.Reward.Phase != "exploit_choice" {
		return nil, fmt.Errorf("exploit reward choice is already resolved")
	}

	var selected *Exploit
	for _, option := range s.State.Reward.ExploitOptions {
		if option != nil && option.ID == exploitID {
			selected = cloneExploit(option)
			break
		}
	}
	if selected == nil {
		return nil, fmt.Errorf("reward exploit %q is not available", exploitID)
	}

	s.State.Reward.SelectedExploitID = exploitID
	s.State.Phase = "reward_selection"
	if !containsExploit(s.State.Inventory, exploitID) {
		s.State.Inventory = append(s.State.Inventory, selected)
		s.State.Progress.ExploitsCollected++
	}

	if len(s.State.Reward.ItemRewards) == 0 {
		s.State.Reward.Phase = "complete"
	} else {
		s.State.Reward.Phase = "item_choice"
	}

	return cloneState(s.State), nil
}

func (s *Session) ResolveRewardItem(itemID string, decision string) (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if (s.State.Phase != "combat_resolved" && s.State.Phase != "reward_selection") || s.State.Reward == nil {
		return nil, fmt.Errorf("item reward is unavailable in phase %s", s.State.Phase)
	}
	if s.State.Reward.Phase != "item_choice" {
		return nil, fmt.Errorf("item reward phase is %s", s.State.Reward.Phase)
	}

	s.State.Phase = "reward_selection"
	reward := s.State.Reward
	if reward.CurrentItemIndex >= len(reward.ItemRewards) {
		reward.Phase = "complete"
		return cloneState(s.State), nil
	}

	current := reward.ItemRewards[reward.CurrentItemIndex]
	if current == nil || current.Item == nil {
		return nil, fmt.Errorf("reward item is unavailable")
	}
	if current.Item.ID != itemID {
		return nil, fmt.Errorf("item %q is not the current reward", itemID)
	}

	switch decision {
	case "keep":
		current.Decision = "keep"
		applyKeptItem(s.State, cloneItem(current.Item))
		s.State.Progress.ItemsKept++
	case "discard":
		current.Decision = "discard"
		s.State.Attention = min(s.State.Attention+current.Item.DiscardAttention, s.State.MaxAttention)
		reward.DiscardAttentionSum += current.Item.DiscardAttention
		s.State.Progress.ItemsDiscarded++
	default:
		return nil, fmt.Errorf("unsupported item decision %q", decision)
	}

	reward.CurrentItemIndex++
	if reward.CurrentItemIndex >= len(reward.ItemRewards) {
		reward.Phase = "complete"
	}

	return cloneState(s.State), nil
}

func (s *Session) CompleteRewards() (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if (s.State.Phase != "combat_resolved" && s.State.Phase != "reward_selection") || s.State.Reward == nil {
		return nil, fmt.Errorf("reward completion is unavailable in phase %s", s.State.Phase)
	}
	if s.State.Reward.Phase != "complete" {
		return nil, fmt.Errorf("reward flow is not complete yet")
	}

	s.State.Reward = nil
	s.State.Phase = "feed"
	s.State.Combat = nil
	return cloneState(s.State), nil
}

func (s *Session) UpdateLoadout(exploitIDs []string) (*GameState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.State.Phase == "combat" || s.State.Phase == "combat_resolved" || s.State.Phase == "reward_selection" {
		return nil, fmt.Errorf("cannot edit loadout during combat")
	}
	if len(exploitIDs) > len(s.State.Exploits) {
		return nil, fmt.Errorf("cannot equip more than %d exploits", len(s.State.Exploits))
	}

	seen := map[string]struct{}{}
	nextLoadout := [4]*Exploit{}
	slot := 0
	for _, exploitID := range exploitIDs {
		if exploitID == "" {
			continue
		}
		if _, exists := seen[exploitID]; exists {
			return nil, fmt.Errorf("duplicate exploit %q in loadout", exploitID)
		}
		if !containsExploit(s.State.Inventory, exploitID) {
			return nil, fmt.Errorf("exploit %q is not in inventory", exploitID)
		}
		seen[exploitID] = struct{}{}
		nextLoadout[slot] = cloneExploitDefinition(exploitID)
		slot++
	}

	s.State.Exploits = nextLoadout
	return cloneState(s.State), nil
}

func cloneState(state *GameState) *GameState {
	if state == nil {
		return nil
	}

	cloned := *state
	cloned.DefeatedEnemies = append([]string(nil), state.DefeatedEnemies...)
	for index, exploit := range state.Exploits {
		cloned.Exploits[index] = cloneExploit(exploit)
	}
	cloned.Inventory = cloneExploitList(state.Inventory)
	cloned.Items = cloneItemList(state.Items)
	if state.Progress != nil {
		progressCloned := *state.Progress
		cloned.Progress = &progressCloned
	}
	if state.Reward != nil {
		rewardCloned := *state.Reward
		rewardCloned.ExploitOptions = cloneExploitList(state.Reward.ExploitOptions)
		rewardCloned.ItemRewards = cloneRewardItems(state.Reward.ItemRewards)
		cloned.Reward = &rewardCloned
	}

	if state.Combat != nil {
		combatCloned := *state.Combat
		if state.Combat.Enemy != nil {
			enemyCloned := *state.Combat.Enemy
			enemyCloned.Abilities = append([]EnemyAbility(nil), state.Combat.Enemy.Abilities...)
			if state.Combat.Enemy.StealableExploit != nil {
				exploitCloned := *state.Combat.Enemy.StealableExploit
				enemyCloned.StealableExploit = &exploitCloned
			}
			combatCloned.Enemy = &enemyCloned
		}
		combatCloned.EnemyDebuffs = cloneIntMap(state.Combat.EnemyDebuffs)
		combatCloned.PlayerDebuffs = cloneIntMap(state.Combat.PlayerDebuffs)
		combatCloned.DisabledExploits = cloneIntMap(state.Combat.DisabledExploits)
		combatCloned.PlayerCooldowns = cloneIntMap(state.Combat.PlayerCooldowns)
		combatCloned.EnemyCooldowns = cloneIntMap(state.Combat.EnemyCooldowns)
		combatCloned.Log = append([]TurnResult(nil), state.Combat.Log...)
		if state.Combat.PendingEnemyAction != nil {
			pending := *state.Combat.PendingEnemyAction
			combatCloned.PendingEnemyAction = &pending
		}
		if state.Combat.PendingPlayerAction != nil {
			pending := *state.Combat.PendingPlayerAction
			combatCloned.PendingPlayerAction = &pending
		}
		cloned.Combat = &combatCloned
	}

	return &cloned
}

func cloneIntMap(input map[string]int) map[string]int {
	if input == nil {
		return nil
	}

	cloned := make(map[string]int, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func cloneExploitList(input []*Exploit) []*Exploit {
	cloned := make([]*Exploit, 0, len(input))
	for _, exploit := range input {
		cloned = append(cloned, cloneExploit(exploit))
	}
	return cloned
}

func cloneExploit(exploit *Exploit) *Exploit {
	if exploit == nil {
		return nil
	}
	cloned := *exploit
	cloned.Effects = append([]StatEffect(nil), exploit.Effects...)
	return &cloned
}

func cloneItemList(input []*Item) []*Item {
	cloned := make([]*Item, 0, len(input))
	for _, item := range input {
		cloned = append(cloned, cloneItem(item))
	}
	return cloned
}

func cloneItem(item *Item) *Item {
	if item == nil {
		return nil
	}
	cloned := *item
	cloned.Effects = append([]StatEffect(nil), item.Effects...)
	return &cloned
}

func cloneRewardItems(input []*RewardItem) []*RewardItem {
	cloned := make([]*RewardItem, 0, len(input))
	for _, rewardItem := range input {
		if rewardItem == nil {
			cloned = append(cloned, nil)
			continue
		}
		entry := *rewardItem
		entry.Item = cloneItem(rewardItem.Item)
		cloned = append(cloned, &entry)
	}
	return cloned
}

func cloneFeedPost(post *FeedPost) *FeedPost {
	if post == nil {
		return nil
	}
	cloned := *post
	return &cloned
}

func generateSessionID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := cryptorand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return hex.EncodeToString(buffer), nil
}
