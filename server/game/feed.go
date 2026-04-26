package game

import (
	"fmt"
	"math/rand"
	"time"
)

type FeedPostType string

const (
	PostTypeNormal FeedPostType = "normal"
	PostTypeEvil   FeedPostType = "evil"
)

type FeedPost struct {
	ID      string          `json:"id"`
	Type    FeedPostType    `json:"type"`
	Content FeedPostContent `json:"content"`
}

type FeedPostContent struct {
	Author    string `json:"author"`
	Handle    string `json:"handle"`
	Message   string `json:"message"`
	Likes     int    `json:"likes,omitempty"`
	EnemyID   string `json:"enemyId,omitempty"`
	EnemyName string `json:"enemyName,omitempty"`
}

type FeedGenerator struct {
	rng          *rand.Rand
	postCounter  uint64
	normalCount  int
	nextEvilPost int
}

type enemySequenceItem struct {
	ID   string
	Name string
}

var enemySequence = []enemySequenceItem{
	{ID: "top_b", Name: "Top B"},
	{ID: "kyle", Name: "Kyle"},
	{ID: "michael", Name: "Michael"},
	{ID: "mr_least", Name: "Mr. Least"},
	{ID: "arisloptle", Name: "Arisloptle"},
}

var normalAuthors = []struct {
	name   string
	handle string
}{
	{name: "Ari", handle: "@ari_dev"},
	{name: "Nia", handle: "@ni4.codes"},
	{name: "Sam", handle: "@samlive"},
	{name: "Lex", handle: "@lex_online"},
	{name: "Jules", handle: "@julz_ai"},
	{name: "Mika", handle: "@mika_feed"},
}

var normalPostTemplates = []string{
	"Shipped a tiny feature and suddenly everything feels possible.",
	"Reminder: your worth is not your engagement graph.",
	"Who else re-reads old messages before hitting send?",
	"Today's build broke three times. Fourth deploy is clean.",
	"Hot take: kindness scales better than growth hacks.",
	"My focus mode playlist is now 92% rain sounds.",
	"Logging off for a walk. The feed will survive without me.",
}

var evilPostTemplates = []string{
	"%s just hijacked this thread. Something is wrong in the feed.",
	"The comments twist into static. %s is watching.",
	"This post shouldn't exist. %s left a corrupted payload.",
	"The screen glitches red. %s pushes through the timeline.",
}

func NewFeedGenerator() *FeedGenerator {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	generator := &FeedGenerator{
		rng: rng,
	}
	generator.nextEvilPost = generator.rollNextEvilPost()
	return generator
}

func (g *FeedGenerator) NextPost(state *GameState) *FeedPost {
	if g.normalCount >= g.nextEvilPost {
		g.normalCount = 0
		g.nextEvilPost = g.rollNextEvilPost()
		return g.nextEvilPostForState(state)
	}

	g.normalCount++
	return g.newNormalPost()
}

func (g *FeedGenerator) rollNextEvilPost() int {
	return 3 + g.rng.Intn(5)
}

func (g *FeedGenerator) nextEvilPostForState(state *GameState) *FeedPost {
	defeated := map[string]struct{}{}
	for _, enemyID := range state.DefeatedEnemies {
		defeated[enemyID] = struct{}{}
	}

	for _, enemy := range enemySequence {
		if _, exists := defeated[enemy.ID]; exists {
			continue
		}

		return g.newEvilPost(enemy)
	}

	state.Phase = "game_over"
	return &FeedPost{
		ID:   g.nextPostID("normal"),
		Type: PostTypeNormal,
		Content: FeedPostContent{
			Author:  "System",
			Handle:  "@the_feed",
			Message: "Run complete. The timeline is finally quiet.",
			Likes:   9999,
		},
	}
}

func (g *FeedGenerator) newNormalPost() *FeedPost {
	author := normalAuthors[g.rng.Intn(len(normalAuthors))]
	message := normalPostTemplates[g.rng.Intn(len(normalPostTemplates))]

	return &FeedPost{
		ID:   g.nextPostID("normal"),
		Type: PostTypeNormal,
		Content: FeedPostContent{
			Author:  author.name,
			Handle:  author.handle,
			Message: message,
			Likes:   8 + g.rng.Intn(340),
		},
	}
}

func (g *FeedGenerator) newEvilPost(enemy enemySequenceItem) *FeedPost {
	template := evilPostTemplates[g.rng.Intn(len(evilPostTemplates))]

	return &FeedPost{
		ID:   g.nextPostID("evil"),
		Type: PostTypeEvil,
		Content: FeedPostContent{
			Author:    "Corrupted Broadcast",
			Handle:    "@void_signal",
			Message:   fmt.Sprintf(template, enemy.Name),
			EnemyID:   enemy.ID,
			EnemyName: enemy.Name,
		},
	}
}

func (g *FeedGenerator) nextPostID(prefix string) string {
	g.postCounter++
	return fmt.Sprintf("%s-%d", prefix, g.postCounter)
}
