import { useState } from 'react';
import { HowToPlayModal } from './components/HowToPlayModal';

const CORE_PILLARS = [
  {
    title: '01 · 9×9 TACTICAL GRID',
    body: 'Battle across an expanded 9×9 board uniting classical chess geometry with arcane tactics.',
  },
  {
    title: '02 · FOG OF DECEPTION',
    body: 'From your opponent’s perspective, enemy pieces appear as masked Pawns—track threats by memory.',
  },
  {
    title: '03 · ADJACENT PAWN REVEAL',
    body: 'Move any Pawn next to a disguised foe to lift its masquerade mask for as long as it stays adjacent.',
  },
  {
    title: '04 · POWER CARDS & COOLDOWNS',
    body: 'Unleash tactical power cards governed by turn cooldowns to flip board momentum.',
  },
  {
    title: '05 · ROYAL-ONLY ELITE',
    body: 'Protected by a Royal Barrier—only your King or Queen can eliminate the Elite piece.',
  },
] as const;

export function App() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="bw-shell">
      <div className="bw-split-seam" aria-hidden="true" />

      <header className="bw-header">
        <div className="bw-brand">
          <span className="bw-studio">MHLGames</span>
          <span className="bw-title-sm">BLIND WAR</span>
        </div>

        <button
          type="button"
          className="bw-btn bw-btn-subtle"
          onClick={() => setModalOpen(true)}
          aria-label="Open How to Play interactive explainer"
        >
          How to Play
        </button>
      </header>

      <main className="bw-main">
        <section className="bw-hero">
          <span className="bw-pill">TACTICAL CHESS VARIANT · AGES 10–50</span>
          <h1>BLIND WAR</h1>
          <p>
            Step into the masquerade between celestial marble and cosmic obsidian. Outsmart your
            rival through strategy, memory, bluffing, and cooldown-driven powers.
          </p>

          <div className="bw-actions">
            <button
              type="button"
              className="bw-btn bw-btn-primary"
              onClick={() => setModalOpen(true)}
            >
              Watch Interactive How to Play
            </button>
          </div>
        </section>

        <section className="bw-rules-grid" aria-label="Core BLIND WAR rules">
          {CORE_PILLARS.map((pillar) => (
            <article key={pillar.title} className="bw-rule-card">
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="bw-footer">
        BLIND WAR by MHLGames · Programmatic Deterministic Explainer Pipeline (16:9 &amp; 9:16)
      </footer>

      <HowToPlayModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default App;
