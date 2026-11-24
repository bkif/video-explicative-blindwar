import { useState } from 'react';
import { HowToPlayModal } from './components/HowToPlayModal';

const CORE_PILLARS = [
  {
    title: '01 · ÉCHIQUIER 9×9',
    body: 'Affrontez-vous sur un plateau élargi 9×9 mêlant géométrie classique et magie cosmique.',
  },
  {
    title: '02 · PIÈCES MASQUÉES',
    body: "Aux yeux de l'adversaire, vos pièces paraissent être de simples pions : une Reine peut s'y cacher.",
  },
  {
    title: '03 · RÉVÉLATION PAR PION COLLÉ',
    body: 'Collez un pion à une pièce ennemie pour lever son masque tant qu’il reste au contact.',
  },
  {
    title: '04 · POUVOIRS & COOLDOWNS',
    body: 'Activez des cartes de pouvoirs à temps de recharge pour renverser le cours du duel.',
  },
  {
    title: '05 · PIÈCE ÉLITE ROYALE',
    body: 'Protégée par une barrière royale : seul le Roi ou la Reine peut éliminer la pièce Élite.',
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
          aria-label="Ouvrir le tutoriel vidéo Comment jouer / How to Play"
        >
          Comment jouer / How to Play
        </button>
      </header>

      <main className="bw-main">
        <section className="bw-hero">
          <span className="bw-pill">VARIANTE D’ÉCHECS TACTIQUE · 10–50 ANS</span>
          <h1>BLIND WAR</h1>
          <p>
            Entrez dans la mascarade entre marbre céleste et obsidienne cosmique. Dominez par la
            stratégie, la mémoire, le bluff et vos cartes de pouvoirs.
          </p>

          <div className="bw-actions">
            <button
              type="button"
              className="bw-btn bw-btn-primary"
              onClick={() => setModalOpen(true)}
            >
              Voir la vidéo explicative (FR · Audio &amp; Sous-titres)
            </button>
          </div>
        </section>

        <section className="bw-rules-grid" aria-label="Règles principales de BLIND WAR">
          {CORE_PILLARS.map((pillar) => (
            <article key={pillar.title} className="bw-rule-card">
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="bw-footer">
        BLIND WAR par MHLGames · Pipeline vidéo programmatique avec voix FR, SFX &amp; sous-titres (16:9 &amp; 9:16)
      </footer>

      <HowToPlayModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default App;
