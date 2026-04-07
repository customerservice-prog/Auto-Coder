import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </div>
        <div className="nav-actions">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-outline">Sign In</button>
            </SignInButton>
            <Link href="/dashboard">
              <button className="btn-primary">Get Started Free</button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="btn-primary">Open IDE</button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-badge">Beyond Cursor. Beyond Copilot.</div>
        <h1 className="hero-title">
          The AI that codes<br />
          <span className="hero-accent">for you.</span>
        </h1>
        <p className="hero-subtitle">
          Auto-Coder plans your mission, writes all the code, runs the tests,
          fixes the bugs, and ships the feature — autonomously.
          You just describe what you want.
        </p>
        <div className="hero-actions">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-hero-primary">Start Coding for Free →</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="btn-hero-primary">Open Your IDE →</button>
            </Link>
          </SignedIn>
          <a href="https://github.com/customerservice-prog/Auto-Coder" target="_blank" rel="noopener noreferrer">
            <button className="btn-hero-secondary">⭐ View on GitHub</button>
          </a>
        </div>

        <div className="feature-grid">
          {[
            { icon: '🤖', title: 'Autonomous Agent', desc: 'Plans, executes, tests, and self-heals — no hand-holding required.' },
            { icon: '🔀', title: 'Multi-Agent Mode', desc: 'Parallel specialist agents tackle frontend, backend, tests, and docs simultaneously.' },
            { icon: '🧬', title: 'Self-Healing Tests', desc: 'Breaks a test? The agent diagnoses and fixes the code — not the test.' },
            { icon: '⚡', title: 'Codebase RAG', desc: 'Indexes your entire repo so the AI always has full context on every call.' },
            { icon: '🏆', title: 'Multi-Model Judge', desc: 'Runs Claude, GPT-4o, and DeepSeek on the same task — picks the winner.' },
            { icon: '📋', title: 'PLAN.md Protocol', desc: 'Live execution log so you can follow the agent's thinking in real time.' },
          ].map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="pricing-section">
          <h2>Simple Pricing</h2>
          <div className="pricing-grid">
            {[
              { name: 'Free', price: '$0', features: ['100 AI requests/day', 'Single agent mode', 'Monaco editor', 'Basic RAG indexing'] },
              { name: 'Pro', price: '$20/mo', highlight: true, features: ['Unlimited requests', 'Multi-agent mode', 'All AI models', 'Self-healing tests', 'Performance auditor'] },
              { name: 'Team', price: '$40/seat/mo', features: ['Everything in Pro', 'Shared memory store', 'CI/CD agent', 'Priority queue', 'Team dashboard'] },
            ].map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.highlight ? 'highlighted' : ''}`}>
                <h3>{plan.name}</h3>
                <div className="price">{plan.price}</div>
                <ul>
                  {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className={plan.highlight ? 'btn-primary' : 'btn-outline'}>
                      Get Started
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Built with Claude 3.7 Sonnet · Open source on <a href="https://github.com/customerservice-prog/Auto-Coder">GitHub</a></p>
      </footer>
    </div>
  );
}
