import Link from 'next/link';
import {
  AccountMenu,
  SignInControl,
  SignedInGate,
  SignedOutGate,
} from '@/components/clerk-ui';
import { CheckoutCanceledBanner } from '@/components/checkout-canceled-banner';
import { StripeSubscribeButton } from '@/components/stripe-subscribe-button';

export default function HomePage() {
  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </div>
        <div className="nav-actions">
          <SignedOutGate>
            <SignInControl>
              <button type="button" className="btn-outline">
                Sign In
              </button>
            </SignInControl>
            <Link href="/dashboard">
              <button type="button" className="btn-primary">
                Get Started Free
              </button>
            </Link>
          </SignedOutGate>
          <SignedInGate>
            <Link href="/dashboard">
              <button type="button" className="btn-primary">
                Open IDE
              </button>
            </Link>
            <AccountMenu />
          </SignedInGate>
        </div>
      </nav>

      <main className="hero">
        <CheckoutCanceledBanner />
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
          <SignedOutGate>
            <SignInControl>
              <button type="button" className="btn-hero-primary">
                Start Coding for Free →
              </button>
            </SignInControl>
          </SignedOutGate>
          <SignedInGate>
            <Link href="/dashboard">
              <button type="button" className="btn-hero-primary">
                Open Your IDE →
              </button>
            </Link>
          </SignedInGate>
        </div>

        <div className="feature-grid">
          {[
            { icon: '🤖', title: 'Autonomous Agent', desc: 'Plans, executes, tests, and self-heals — no hand-holding required.' },
            { icon: '🔀', title: 'Multi-Agent Mode', desc: 'Parallel specialist agents tackle frontend, backend, tests, and docs simultaneously.' },
            { icon: '🧬', title: 'Self-Healing Tests', desc: 'Breaks a test? The agent diagnoses and fixes the code — not the test.' },
            { icon: '⚡', title: 'Codebase RAG', desc: 'Indexes your entire repo so the AI always has full context on every call.' },
            { icon: '🏆', title: 'Multi-Model Judge', desc: 'Runs Claude, GPT-4o, and DeepSeek on the same task — picks the winner.' },
            { icon: '📋', title: 'PLAN.md Protocol', desc: "Live execution log so you can follow the agent's thinking in real time." },
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
              {
                name: 'Free',
                price: '$0',
                features: ['100 AI requests/day', 'Single agent mode', 'Monaco editor', 'Basic RAG indexing'],
              },
              {
                name: 'Pro',
                price: '$20/mo',
                highlight: true,
                checkoutPlan: 'pro' as const,
                features: [
                  'Unlimited requests',
                  'Multi-agent mode',
                  'All AI models',
                  'Self-healing tests',
                  'Performance auditor',
                ],
              },
              {
                name: 'Team',
                price: '$40/seat/mo',
                checkoutPlan: 'team' as const,
                features: [
                  'Everything in Pro',
                  'Shared memory store',
                  'CI/CD agent',
                  'Priority queue',
                  'Team dashboard',
                ],
              },
            ].map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.highlight ? 'highlighted' : ''}`}>
                <h3>{plan.name}</h3>
                <div className="price">{plan.price}</div>
                <ul>
                  {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <div className="pricing-cta">
                  <SignedOutGate>
                    <SignInControl>
                      <button
                        type="button"
                        className={plan.highlight ? 'btn-primary' : 'btn-outline'}
                      >
                        Get Started
                      </button>
                    </SignInControl>
                  </SignedOutGate>
                  <SignedInGate>
                    {'checkoutPlan' in plan && plan.checkoutPlan ? (
                      <StripeSubscribeButton
                        plan={plan.checkoutPlan}
                        className={plan.highlight ? 'btn-primary' : 'btn-outline'}
                      >
                        Subscribe with Stripe
                      </StripeSubscribeButton>
                    ) : (
                      <Link href="/dashboard">
                        <button type="button" className="btn-outline">
                          Open dashboard
                        </button>
                      </Link>
                    )}
                  </SignedInGate>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
