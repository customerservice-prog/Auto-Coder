'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AccountMenu } from '@/components/clerk-ui';
import { StripePortalButton } from '@/components/stripe-portal-button';
import { AGENT_MISSION_MAX_CHARS, AGENT_PROJECT_CONTEXT_MAX_CHARS } from '@/lib/agent-api-limits';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import type { AgentErrorBody } from '@/lib/agent-error-format';
import { formatAgentApiError } from '@/lib/agent-error-format';
import {
  STRIPE_ENTITLEMENT_TIER_KEY,
  normalizeEntitlementTier,
} from '@/lib/stripe-entitlements';

type ModelId = 'claude' | 'gpt4o' | 'deepseek';

function ProPlanBadge() {
  const { user, isLoaded } = useUser();
  const tier = isLoaded
    ? normalizeEntitlementTier(user?.publicMetadata?.[STRIPE_ENTITLEMENT_TIER_KEY])
    : 'free';
  if (!isLoaded || tier !== 'pro') {
    return null;
  }
  return (
    <span className="dash-plan-badge" title="Synced from Stripe subscription status">
      Pro
    </span>
  );
}

/**
 * After hosted Checkout, Stripe webhooks update Clerk — `user.reload()` pulls fresh `publicMetadata` (e.g. Pro badge) without a hard refresh.
 * Only mounted when Clerk is enabled (requires `ClerkProvider`).
 */
function PostCheckoutClerkRefresh({ show }: { show: boolean }) {
  const { user } = useUser();
  const didReload = useRef(false);

  useEffect(() => {
    if (!show || !user || didReload.current) {
      return;
    }
    didReload.current = true;
    void user.reload().catch(() => {});
  }, [show, user]);

  return null;
}

export default function DashboardPage() {
  const [checkoutSuccessBanner, setCheckoutSuccessBanner] = useState(false);
  const [mission, setMission] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [model, setModel] = useState<ModelId>('claude');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHint, setQuotaHint] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') {
      return;
    }
    setCheckoutSuccessBanner(true);
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  async function runAssistant() {
    setLoading(true);
    setError(null);
    setOutput('');
    setQuotaHint(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission, projectContext, model }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as AgentErrorBody | null;
        setError(formatAgentApiError(res, body));
        return;
      }

      const rem = res.headers.get('X-RateLimit-Remaining');
      const lim = res.headers.get('X-RateLimit-Limit');
      const dayUsed = res.headers.get('X-Agent-Quota-Daily-Used');
      const dayLim = res.headers.get('X-Agent-Quota-Daily-Limit');
      if (rem != null && lim != null) {
        const hint = `This window: ${rem} / ${lim} requests left.`;
        setQuotaHint(
          dayUsed != null && dayLim != null ? `${hint} Today: ${dayUsed} / ${dayLim}.` : hint
        );
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('No response body');
        return;
      }

      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setOutput(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      {isClerkEnabled() ? <PostCheckoutClerkRefresh show={checkoutSuccessBanner} /> : null}
      <nav className="dash-nav">
        <Link href="/" className="nav-brand-link">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </Link>
        <div className="dash-nav-actions">
          {isClerkEnabled() ? (
            <StripePortalButton className="btn-outline dash-billing-btn">Manage billing</StripePortalButton>
          ) : null}
          <AccountMenu />
        </div>
      </nav>

      <main className="dash-main">
        {checkoutSuccessBanner ? (
          <p className="dash-banner dash-banner-success" role="status">
            Checkout complete — we refreshed your Clerk session; the Pro badge appears once Stripe webhooks sync (usually within seconds).
          </p>
        ) : null}
        <h1 className="dash-title">
          Web assistant
          {isClerkEnabled() ? <ProPlanBadge /> : null}
        </h1>
        <p className="dash-sub">
          Paste repo context and describe what you want. The model streams a structured plan and implementation
          guide. Use the desktop app for full autonomous edits on disk.
        </p>

        <div className="dash-form">
          <label className="dash-label">
            Model
            <select
              className="dash-input"
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
              disabled={loading}
            >
              <option value="claude">Claude Sonnet</option>
              <option value="gpt4o">GPT-4o</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>

          <label className="dash-label">
            Project context (paste key files, errors, stack traces…)
            <textarea
              className="dash-textarea dash-textarea-context"
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              placeholder="// optional — helps the model understand your codebase"
              maxLength={AGENT_PROJECT_CONTEXT_MAX_CHARS}
              disabled={loading}
            />
          </label>

          <label className="dash-label">
            Mission
            <textarea
              className="dash-textarea"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              placeholder="e.g. Add pagination to the users table and fix the flaky test in auth.test.ts"
              maxLength={AGENT_MISSION_MAX_CHARS}
              disabled={loading}
            />
          </label>

          <button type="button" className="btn-primary dash-submit" disabled={loading || !mission.trim()} onClick={runAssistant}>
            {loading ? 'Running…' : 'Run assistant'}
          </button>
        </div>

        {quotaHint ? <p className="dash-quota-hint">{quotaHint}</p> : null}

        {error ? <div className="dash-error">{error}</div> : null}

        {output ? (
          <section className="dash-output">
            <h2>Output</h2>
            <pre className="dash-pre">{output}</pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
