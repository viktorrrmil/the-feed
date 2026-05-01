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
                            Combat is turn-based. You and the enemy use the same action system.
                        </p>
                        <ol>
                            <li>Choose an action.</li>
                            <li>End your turn.</li>
                            <li>The enemy thinks for a short delay.</li>
                            <li>The enemy action is revealed.</li>
                            <li>Both actions resolve step by step.</li>
                        </ol>
                    </article>

                    <article className="how-card">
                        <h2>Actions</h2>
                        <ul>
                            <li>
                                <strong>Attack:</strong> Deals damage using AT cost/value. Successful attacks refund
                                AT based on damage dealt.
                            </li>
                            <li>
                                <strong>Block:</strong> Reduces incoming attack damage using block strength.
                            </li>
                            <li>
                                <strong>Parry:</strong> A high-risk counter that can reduce or fully reflect attacks.
                            </li>
                            <li>
                                <strong>Exploit:</strong> Special moves learned from enemies. You can equip up to 4.
                            </li>
                        </ul>
                    </article>

                    <article className="how-card how-card-wide">
                        <h2>AT System</h2>
                        <p>
                            AT is both your health and your combat resource. Attacks cost AT, blocking and parrying
                            use AT as defensive value, and successful attacks refund AT based on damage dealt.
                        </p>
                        <p>
                            If AT reaches 0 in combat, you lose the run.
                        </p>
                    </article>

                    <article className="how-card">
                        <h2>What You Always See</h2>
                        <ul>
                            <li>Your AT and health bar.</li>
                            <li>Your equipped exploits.</li>
                            <li>Your selected actions.</li>
                            <li>The enemy HP and current stance.</li>
                            <li>The enemy stance is revealed every turn.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Progression</h2>
                        <ul>
                            <li>You gain exploits from defeated enemies.</li>
                            <li>You may receive items that affect AT or combat stats.</li>
                            <li>Difficulty increases as you survive more posts.</li>
                        </ul>
                    </article>

                    <article className="how-card">
                        <h2>Run End</h2>
                        <ul>
                            <li>You lose when your AT reaches 0 in combat.</li>
                            <li>You win when all 5 enemies are defeated.</li>
                            <li>Final score equals total posts survived.</li>
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