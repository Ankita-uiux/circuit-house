import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Star } from 'lucide-react';
import { apiUrl } from '@/shared';

type Status = {
  running: boolean; done: number; total: number; found: number; failed: number;
  startedAt: string | null; finishedAt: string | null; lastError: string | null; stored: number; catalogSize: number;
};

/**
 * Admin: fetch real star ratings, review counts, colours and MRP for the
 * catalog from the web, once. Uses the OpenAI key, so it only runs when asked.
 */
export default function ProductData({ password }: { password: string }) {
  const headers = password ? { 'x-admin-password': password } : undefined;
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/shop/admin/enrichment'), { headers, cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      setStatus(await response.json() as Status);
    } catch {
      setError('The product data status couldn’t be loaded.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!status?.running) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [status?.running, load]);

  const start = async (refresh: boolean) => {
    setError('');
    const response = await fetch(apiUrl('/shop/admin/enrichment'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ refresh }),
    });
    if (!response.ok && response.status !== 409) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? 'The lookup couldn’t start.');
    }
    void load();
  };

  const missing = status ? Math.max(0, status.catalogSize - status.stored) : 0;
  return (
    <section className="admin-panel" aria-labelledby="product-data-title">
      <div className="admin-panel-head">
        <div className="admin-panel-number">04</div>
        <div><div className="admin-section-kicker">Store data</div><h2 id="product-data-title">Ratings, reviews and colours</h2></div>
      </div>
      <p className="admin-help">
        Looks up each product’s real star rating, number of ratings, colours and MRP on Indian store listings and saves them. Products show nothing when no real data is found. This uses web search on your OpenAI key: about one search per product (roughly $1–2 for the whole catalog), so run it once, not every day.
      </p>
      {status && (
        <p className="admin-help" data-testid="text-enrichment-status">
          <Star size={13} /> {status.stored} of {status.catalogSize} products have saved data.
          {status.running && <> Looking up… {status.done} of {status.total} done.</>}
          {!status.running && status.finishedAt && <> Last run finished {new Date(status.finishedAt).toLocaleString('en-IN')}: {status.found} found, {status.failed} failed.</>}
        </p>
      )}
      {error && <p className="test-sessions-error" role="alert">{error}</p>}
      <div className="test-sessions-actions">
        <button type="button" onClick={() => void start(false)} disabled={!status || status.running || missing === 0} data-testid="button-enrich-missing">
          {status?.running ? 'Running…' : missing ? `Look up ${missing} products` : 'All products looked up'}
        </button>
        <button type="button" onClick={() => void start(true)} disabled={!status || status.running} data-testid="button-enrich-refresh"><RotateCcw size={13} /> Refresh all</button>
      </div>
    </section>
  );
}
