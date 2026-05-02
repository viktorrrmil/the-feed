interface HowToPlayScreenProps {
    onBack: () => void
}

function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
    return (
        <main className="screen how-to-play-screen">
            <section className="panel how-to-play-panel">
                <p className="eyebrow how-to-play-eyebrow">The Feed</p>
                <h1 className="how-to-play-title">How to Play</h1>
                <p className="subtitle how-to-play-intro">
                    A run-based scrolling RPG about surviving a corrupted feed and fighting viral entities.
                </p>

                <div className="how-to-play-layout">
                    <article className="how-card how-card-wide">
                        <h2>Core Objective</h2>
                        <p>
                            Survive as many posts as possible in a single run. Your score is the number of posts
                            you successfully pass before dying.
                        </p>
                        <p>
                            You will eventually face 5 main enemies across the run. Defeating all of them
                            completes the game.
                        </p>
                    </article>

                    <article className="how-card">
                        <h2>Feed Mode</h2>
                        <p>
                            This is the default mode. You scroll through a simulated phone feed while posts move
                            automatically and through your input.
                        </p>
                        <ul>
                            <li>Most posts are harmless real posts.</li>
                            <li>Some posts are evil posts that trigger combat.</li>
                            <li>Real posts are safe and may stabilize the run.</li>
                            <li>Evil posts pull you into the Feed Domain.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Combat Mode</h2>
                        <p>
                            Combat uses simultaneous resolution. You and the enemy choose actions, then both resolve together.
                        </p>
                        <ol>
                            <li>Choose your action.</li>
                            <li>Finish your turn.</li>
                            <li>The enemy selects an action after a short delay.</li>
                            <li>Both actions are revealed.</li>
                            <li>Actions resolve step by step.</li>
                        </ol>
                        <p>
                            Every turn is a trade. You must predict and outplay the enemy’s choice.
                        </p>
                    </article>

                    <article className="how-card">
                        <h2>Actions</h2>
                        <ul>
                            <li>
                                <strong>Attack:</strong> Deals damage using AT. You regain AT based on actual damage dealt.
                            </li>
                            <li>
                                <strong>Block:</strong> Reduces incoming damage using its value. Prevents or minimizes loss.
                            </li>
                            <li>
                                <strong>Parry:</strong> Counters attacks. If strong enough, reflects damage back to the enemy.
                            </li>
                            <li>
                                <strong>Exploit:</strong> Special abilities stolen from enemies. You can equip up to 4.
                            </li>
                        </ul>
                        <p>
                            All actions have cooldowns. Basic actions have short cooldowns, while exploits take longer to reuse.
                        </p>
                    </article>

                    <article className="how-card how-card-wide">
                        <h2>Combat Resolution</h2>
                        <ul>
                            <li><strong>Attack vs Attack:</strong> both sides deal full damage.</li>
                            <li><strong>Attack vs Block:</strong> damage is reduced by block value.</li>
                            <li><strong>Attack vs Parry:</strong> strong parry reflects damage back.</li>
                        </ul>
                        <p>
                            You always see what the enemy chose before the result resolves. Pay attention to their patterns.
                        </p>
                    </article>

                    <article className="how-card how-card-wide">
                        <h2>AT System</h2>
                        <p>
                            AT is both your health and your resource. Every action costs AT, but successful actions can restore it.
                        </p>
                        <p>
                            Managing AT is key — overspending leaves you vulnerable, but playing too safe slows you down.
                        </p>
                        <p>
                            If AT reaches 0 in combat, the run ends.
                        </p>
                    </article>

                    <article className="how-card">
                        <h2>Feed Interactions</h2>
                        <ul>
                            <li>Scrolling past posts can restore a small amount of AT.</li>
                            <li>Liking safe posts can also restore AT.</li>
                            <li>Some posts are traps and give no benefit.</li>
                            <li>Evil posts always trigger combat.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Rewards</h2>
                        <ul>
                            <li>After winning a fight, you choose 1 of 2 exploits.</li>
                            <li>You may also receive items that affect your stats.</li>
                            <li>Items can be kept or discarded for AT.</li>
                            <li>You return to the feed only after resolving rewards.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Inventory</h2>
                        <ul>
                            <li>All collected exploits and items are stored during the run.</li>
                            <li>You can equip up to 4 exploits at a time.</li>
                            <li>Inventory can be edited outside combat.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Run End</h2>
                        <ul>
                            <li>You lose when your AT reaches 0.</li>
                            <li>You win by defeating all 5 enemies.</li>
                            <li>Your score is the number of posts survived.</li>
                        </ul>
                    </article>

                    <article className="how-card how-card-wide">
                        <h2>Enemies and Exploits</h2>
                        <p>
                            Each enemy is a corrupted feed archetype with unique behavior and a stealable exploit.
                        </p>

                        <div className="enemy-grid">
                            <div className="enemy-tile enemy-top-b">
                                <h3>Top B</h3>
                                <p className="enemy-role">The Course Seller</p>
                                <p>Structured guru and monetization pressure.</p>
                                <p className="enemy-mini-title">Abilities</p>
                                <ul>
                                    <li>Paywall Slam: moderate attack, disables exploits for 1 turn.</li>
                                    <li>Value Injection: low attack, heals self and forces engagement.</li>
                                </ul>
                                <p className="enemy-mini-title">Stealable Exploit</p>
                                <p>Growth Hack: converts AT efficiency into damage scaling.</p>
                            </div>

                            <div className="enemy-tile enemy-kyle">
                                <h3>Kyle</h3>
                                <p className="enemy-role">The Crypto Bro</p>
                                <p>Volatility, hype, and unstable logic.</p>
                                <p className="enemy-mini-title">Abilities</p>
                                <ul>
                                    <li>Pump: high variance attack that adds Noise.</li>
                                    <li>HODL: defensive sustain that softens incoming damage.</li>
                                    <li>Dump: burst attack that can bypass block.</li>
                                </ul>
                                <p className="enemy-mini-title">Stealable Exploit</p>
                                <p>Volatility Engine: damage scales with randomness and Noise.</p>
                            </div>

                            <div className="enemy-tile enemy-michael">
                                <h3>Michael</h3>
                                <p className="enemy-role">The Reseller</p>
                                <p>Exploitation, copying, and reuse logic.</p>
                                <p className="enemy-mini-title">Abilities</p>
                                <ul>
                                    <li>Resell Cycle: standard attack with slight AT efficiency gain.</li>
                                    <li>Copy Exploit: repeats your last exploit or action.</li>
                                </ul>
                                <p className="enemy-mini-title">Stealable Exploit</p>
                                <p>Mirror License: copy enemy actions once per fight.</p>
                            </div>

                            <div className="enemy-tile enemy-mr-least">
                                <h3>Mr. Least</h3>
                                <p className="enemy-role">The Clickbaiter</p>
                                <p>Attention manipulation and disruption.</p>
                                <p className="enemy-mini-title">Abilities</p>
                                <ul>
                                    <li>Engagement Spike: high pressure attack with partial block ignore.</li>
                                    <li>Clickbait Loop: multi-hit pressure and exploit denial.</li>
                                </ul>
                                <p className="enemy-mini-title">Stealable Exploit</p>
                                <p>Bait Loop: repeats the last enemy action with modified stats.</p>
                            </div>

                            <div className="enemy-tile enemy-arisloptle">
                                <h3>Arisloptle</h3>
                                <p className="enemy-role">The Larp Philosopher</p>
                                <p>Abstract logic, unstable rules, and cognitive disruption.</p>
                                <p className="enemy-mini-title">Abilities</p>
                                <ul>
                                    <li>Interpretation Drift: semi-random attack that adds Noise.</li>
                                    <li>Thesis Whiplash: heavy attack that ignores parry.</li>
                                    <li>Dialectic Pause: self-heal with temporary damage reduction.</li>
                                </ul>
                                <p className="enemy-mini-title">Stealable Exploit</p>
                                <p>None. The chaos stays unrecovered.</p>
                            </div>
                        </div>
                    </article>
                </div>

                <div className="how-to-play-actions">
                    <button type="button" className="how-back-button" onClick={onBack}>
                        Back to Main Menu
                    </button>
                </div>
            </section>
        </main>
    )
}

export default HowToPlayScreen