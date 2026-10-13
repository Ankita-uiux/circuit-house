import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Pencil, RotateCcw, Trash2 } from 'lucide-react';

type SessionSummary = {
  id: string;
  title: string | null;
  participantName: string | null;
  participant: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  messageCount: number;
  cards: string[];
};

type SessionMessage = {
  id: number;
  role: 'user' | 'assistant' | 'card' | 'error';
  content: string;
  productIds: string[];
  latencyMs: number | null;
  createdAt: string;
};

type SessionDetail = {
  id: string;
  title: string | null;
  participantName: string | null;
  participant: string | null;
  createdAt: string;
  settings: { empathyScale?: number; goalOrientationScale?: number; tone?: string; persona?: string } | null;
  messages: SessionMessage[];
};

const API = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/shop/chat-sessions`;

const timeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const clockFormat = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
const formatTime = (value: string | null) => (value ? timeFormat.format(new Date(value)) : '—');

/** Saved test conversations, with the cards the facilitator handed out. Admin only. */
export default function TestSessions({ password }: { password: string }) {
  const headers = password ? { 'x-admin-password': password } : undefined;
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setError('');
    try {
      const response = await fetch(`${API}?page=${page}`, { headers, cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as { sessions: SessionSummary[]; total: number; page: number; pageSize: number };
      if (sequence !== loadSequence.current) return;
      setSessions(body.sessions);
      setTotal(body.total);
      setPage(body.page);
      setPageSize(body.pageSize);
    } catch {
      if (sequence !== loadSequence.current) return;
      setError('Test sessions couldn’t be loaded. Try again in a moment.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, page]);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); ++loadSequence.current; };
  }, [load]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId || editingTitle) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(`${API}/${encodeURIComponent(selectedId)}`, { headers, cache: 'no-store' });
        if (!response.ok) throw new Error('Could not refresh');
        const detail = await response.json() as SessionDetail;
        if (active) setSelected(detail);
      } catch {
        if (active) setError('Live updates couldn’t be loaded. The last saved view is still shown; try Refresh.');
      }
    };
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, password, editingTitle]);

  const open = async (id: string) => {
    setLoadingDetail(true);
    setConfirmDelete(false);
    setEditingTitle(false);
    setRenameError('');
    try {
      const response = await fetch(`${API}/${encodeURIComponent(id)}`, { headers });
      if (!response.ok) throw new Error(String(response.status));
      setSelected(await response.json() as SessionDetail);
    } catch {
      setError('That session couldn’t be opened.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const rename = async () => {
    if (!selected || renaming) return;
    const title = titleDraft.trim();
    if (!title || title.length > 100) { setRenameError('Enter a chat name between 1 and 100 characters.'); return; }
    setRenaming(true);
    setRenameError('');
    try {
      const response = await fetch(`${API}/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('Rename failed');
      setSelected((current) => current?.id === selected.id ? { ...current, title } : current);
      setEditingTitle(false);
      void load();
    } catch {
      setRenameError('The chat name couldn’t be saved. Your edit is still here; try again.');
    } finally {
      setRenaming(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const response = await fetch(`${API}/${encodeURIComponent(selected.id)}`, { method: 'DELETE', headers });
    if (response.ok) {
      setSelected(null);
      setConfirmDelete(false);
      void load();
    } else {
      setError('That session couldn’t be deleted.');
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API}/export.csv`, { headers });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `circuit-house-test-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('The export failed. Try again in a moment.');
    } finally {
      setExporting(false);
    }
  };

  const totalCards = sessions?.reduce((sum, session) => sum + session.cards.length, 0) ?? 0;

  return (
    <section className="admin-panel test-sessions" aria-labelledby="sessions-title">
      <div className="admin-panel-head">
        <div className="admin-panel-number">03</div>
        <div><div className="admin-section-kicker">User testing</div><h2 id="sessions-title">Test sessions</h2></div>
        <div className="test-sessions-actions">
          <button type="button" onClick={() => void load()} data-testid="button-refresh-sessions"><RotateCcw size={13} /> Refresh</button>
          <button type="button" onClick={() => void exportCsv()} disabled={exporting || !sessions?.length} data-testid="button-export-sessions"><Download size={13} /> {exporting ? 'Preparing…' : 'Download CSV'}</button>
        </div>
      </div>

      {error && <p className="test-sessions-error" role="alert">{error}</p>}

      {selected ? (
        <div className="test-session-detail" data-testid="session-detail">
          <div className="test-session-detail-head">
            <button type="button" className="test-sessions-back" disabled={renaming} onClick={() => { setSelected(null); setConfirmDelete(false); }} data-testid="button-back-sessions"><ArrowLeft size={14} /> All sessions</button>
            <button type="button" disabled={renaming} onClick={() => { setTitleDraft(selected.title || formatTime(selected.createdAt)); setEditingTitle(true); setRenameError(''); }} data-testid="button-rename-session"><Pencil size={13} /> Rename chat</button>
            <button type="button" className={`test-sessions-delete${confirmDelete ? ' is-confirm' : ''}`} onClick={() => void remove()} data-testid="button-delete-session"><Trash2 size={13} /> {confirmDelete ? 'Tap again to delete' : 'Delete session'}</button>
          </div>
          <h3 className="test-session-title">{selected.title || formatTime(selected.createdAt)}</h3>
          {editingTitle && <form className="test-session-rename" onSubmit={(event) => { event.preventDefault(); void rename(); }}>
            <label htmlFor="chat-title">Chat name</label>
            <input id="chat-title" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} maxLength={100} autoFocus disabled={renaming} />
            <button type="submit" disabled={renaming || !titleDraft.trim()}>{renaming ? 'Saving…' : 'Save name'}</button>
            <button type="button" disabled={renaming} onClick={() => { setEditingTitle(false); setRenameError(''); }}>Cancel</button>
          </form>}
          {renameError && <p role="alert" className="test-sessions-error">{renameError}</p>}
          <dl className="test-session-meta">
            {selected.participantName && <div><dt>Name given in chat</dt><dd>{selected.participantName}</dd></div>}
            {selected.participant && <div><dt>Test label</dt><dd>{selected.participant}</dd></div>}
            <div><dt>Started</dt><dd>{formatTime(selected.createdAt)}</dd></div>
            <div><dt>Empathy</dt><dd>{selected.settings?.empathyScale ?? '—'} / 10</dd></div>
            <div><dt>Initiative</dt><dd>{selected.settings?.goalOrientationScale ?? '—'} / 10</dd></div>
          </dl>
          <ol className="test-transcript">
            {selected.messages.map((message) => (
              <li key={message.id} className={`test-turn test-turn-${message.role}`}>
                <span className="test-turn-time">{clockFormat.format(new Date(message.createdAt))}</span>
                {message.role === 'card' ? (
                  <span className="test-turn-cardlabel">Card given · {message.content}</span>
                ) : (
                  <div className="test-turn-body">
                    <span className="test-turn-role">{message.role === 'user' ? 'Participant' : message.role === 'assistant' ? 'Ask Circuit' : 'Error'}</span>
                    <p>{message.content}</p>
                    {message.role === 'assistant' && (message.productIds.length > 0 || message.latencyMs) && (
                      <span className="test-turn-extra">
                        {message.productIds.length > 0 && <>Suggested: {message.productIds.join(', ')}</>}
                        {message.latencyMs ? `${message.productIds.length ? ' · ' : ''}${(message.latencyMs / 1000).toFixed(1)}s` : ''}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
            {!selected.messages.length && <li className="test-sessions-empty">No messages in this session yet.</li>}
          </ol>
        </div>
      ) : sessions === null ? (
        <p className="test-sessions-empty">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="test-sessions-empty">
          <strong>No test sessions yet.</strong>
          <p>Start a chat on any device and enter a first name or nickname. Saved conversations appear here automatically. Use <code>?facilitator=1</code> to log test cards too.</p>
        </div>
      ) : (
        <>
          <p className="test-sessions-summary">{total} {total === 1 ? 'chat' : 'chats'} across all devices · Updates every 10 seconds · {totalCards} cards on this page</p>
          <div className="test-sessions-table-wrap">
            <table className="test-sessions-table">
              <thead><tr><th>Chat name</th><th>Started</th><th>Test label</th><th>Messages</th><th>Cards given</th><th /></tr></thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td><strong>{session.title || formatTime(session.createdAt)}</strong></td>
                    <td>{formatTime(session.createdAt)}</td>
                    <td>{session.participant || <span className="test-muted">Not set</span>}</td>
                    <td>{session.messageCount}</td>
                    <td>{session.cards.length ? session.cards.map((card) => card.slice(0, 2)).join(', ') : <span className="test-muted">None</span>}</td>
                    <td><button type="button" onClick={() => void open(session.id)} disabled={loadingDetail} data-testid={`button-open-session-${session.id}`}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="test-sessions-pagination" aria-label="Chatlog pages">
            <button type="button" disabled={page === 1} onClick={() => setPage(1)}>First</button>
            <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</button>
            <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(Math.ceil(total / pageSize))}>Last</button>
          </nav>
        </>
      )}
    </section>
  );
}
