import type { CSSProperties } from 'react';

const BENEFITS: { icon: string; title: string; body: string; accent: string; accentBg: string }[] = [
  {
    icon: '◆',
    title: 'Four independent takes',
    body: "Every prompt is answered by four different models before any of them see each other's reasoning — real diversity of thought, not one model's blind spot repeated four times.",
    accent: 'var(--grok)',
    accentBg: 'var(--grok-bg)',
  },
  {
    icon: '⇄',
    title: 'Real debate, not a vote',
    body: 'Models see each other’s actual named answers and get up to three rounds to push back, concede, or refine their position — disagreements get argued out, not just tallied.',
    accent: 'var(--gemini)',
    accentBg: 'var(--gemini-bg)',
  },
  {
    icon: '✓',
    title: 'A confidence-scored verdict',
    body: 'A fifth model reads the whole transcript and writes a final verdict, plus a table showing exactly which models agreed, which disagreed, and how confident each one was.',
    accent: 'var(--agree)',
    accentBg: 'var(--agree-bg)',
  },
  {
    icon: '⤓',
    title: 'Full transparency',
    body: 'Nothing is hidden — every round, every model’s raw answer, and the final synthesis are all visible live and export to a single Markdown file.',
    accent: 'var(--claude)',
    accentBg: 'var(--claude-bg)',
  },
];

export function AboutSection() {
  return (
    <section className="about-section">
      <h2>What is Model Council?</h2>
      <p className="about-lede">
        Model Council sends your prompt to four independent AI models at once, lets them read and respond to each
        other's real, named answers across up to three rounds of debate, then hands the full transcript to a
        synthesizer model that writes a final verdict and scores exactly where each model agreed, disagreed, and
        how confident it was.
      </p>
      <div className="benefit-grid">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="benefit-card"
            style={{ '--card-accent': b.accent, '--card-accent-bg': b.accentBg } as CSSProperties}
          >
            <span className="benefit-icon">{b.icon}</span>
            <h3>{b.title}</h3>
            <p>{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
