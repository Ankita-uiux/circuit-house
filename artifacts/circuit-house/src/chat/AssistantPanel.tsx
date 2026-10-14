import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ChevronRight, CornerUpLeft, MessageCircle, Plus, Send, SquarePen, X } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useChatInactivity } from '@/hooks/use-chat-inactivity';
import { ProductVisual, formatPrice } from '@/shared';
import { useChat, type ChatMessage } from './chat-context';
import { TEST_CARDS, postSessionEvent, readFacilitatorMode } from './session-events';

const SUGGESTIONS = ['Laptop for Figma under ₹80,000', 'Phone under ₹30,000', 'Earbuds with ANC under ₹5,000'];
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Floating button that opens the chat. Hidden while the panel is open. */
export function AssistantLauncher() {
  const { open, setOpen, messages } = useChat();
  if (open) return null;
  return (
    <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label="Open the shopping assistant" data-testid="button-open-assistant">
      <MessageCircle size={20} strokeWidth={2} />
      <span>Ask Circuit</span>
      {messages.length > 1 && <span className="assistant-fab-dot" aria-hidden="true" />}
    </button>
  );
}

/**
 * The chat panel. It stays mounted while closed, so reopening it shows the same
 * conversation at the same scroll position.
 */
export function AssistantPanel({ onAdd }: { onAdd: (product: Product) => void }) {
  const chat = useChat();
  const { open, setOpen, messages, pending, participantName, prompt, setPrompt, quote, setQuote, send, error, loading } = chat;
  const { toast } = useToast();
  const [facilitator] = useState(readFacilitatorMode);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const seen = useRef(messages.length);
  const [unread, setUnread] = useState<number | null>(null);
  const collectingName = !participantName;

  useChatInactivity(open && !!participantName, !!pending, chat.sessionId, messages.length, () => {
    chat.pushLocal({ role: 'assistant', content: 'Are you still there?' });
    void postSessionEvent(chat.sessionId, { type: 'inactivity' }).catch(() => {
      toast({ title: 'Reminder could not be saved', description: 'The inactivity reminder appeared here, but could not be saved to the chat log.' });
    });
  });

  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const scrollToMessage = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const list = listRef.current;
    const element = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (list && element) list.scrollTo({ top: element.offsetTop - 12, behavior });
  };
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior });
  };

  // A restored or reset conversation opens at its latest message.
  useLayoutEffect(() => {
    if (loading) return;
    seen.current = messages.length;
    scrollToBottom('auto');
    // only when loading finishes or the session changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, chat.sessionId]);

  // New messages: show the shopper's own message at the bottom; show a new reply from its START,
  // unless the shopper has scrolled up to read something, in which case offer a "New message" pill.
  useEffect(() => {
    const previous = seen.current;
    seen.current = messages.length;
    if (messages.length <= previous) return;
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      nearBottom.current = true;
      setUnread(null);
      requestAnimationFrame(() => scrollToBottom());
      return;
    }
    const index = messages.length - 1;
    if (nearBottom.current) requestAnimationFrame(() => scrollToMessage(index));
    else setUnread(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => { if (pending && nearBottom.current) requestAnimationFrame(() => scrollToBottom()); }, [pending]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 140;
    if (unread !== null) {
      const element = list.querySelector<HTMLElement>(`[data-index="${unread}"]`);
      if (element && element.offsetTop < list.scrollTop + list.clientHeight - 40) setUnread(null);
    }
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    void send();
  };
  const replyTo = (message: ChatMessage) => {
    setQuote(message.content);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className={`assistant-panel-scrim${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`assistant-panel${open ? ' is-open' : ''}`} role="dialog" aria-labelledby="assistant-panel-title" aria-hidden={!open} inert={!open} data-testid="panel-assistant">
        <header className="assistant-panel-top">
          <h2 id="assistant-panel-title">Ask Circuit <span className="assistant-beta">Beta</span></h2>
          <button type="button" className="assistant-icon-btn" onClick={chat.newChat} disabled={!!pending} aria-label="Start a new chat" title="New chat" data-testid="button-new-chat"><SquarePen size={18} /></button>
          <button type="button" className="assistant-icon-btn" onClick={() => setOpen(false)} aria-label="Close the shopping assistant" title="Close" data-testid="button-close-assistant"><X size={18} /></button>
        </header>
        {facilitator && <FacilitatorBar sessionId={chat.sessionId} onNewSession={chat.newParticipant} />}

        <div className="assistant-panel-messages" ref={listRef} onScroll={onScroll} aria-live="polite" data-testid="assistant-conversation">
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} data-index={index} className={`assistant-turn ${message.role}`}>
              {message.quote && <div className="assistant-quote-in-turn"><CornerUpLeft size={12} /> <span>{message.quote}</span></div>}
              <div className={`assistant-message ${message.role}`} data-testid={`message-${message.role}-${index}`}>
                {message.role === 'assistant' ? <FormattedReply text={message.content} /> : message.content}
              </div>
              {!!message.products?.length && (
                <div className="assistant-picks">
                  {message.products.map((product) => (
                    <div key={product.id} className="assistant-pick">
                      <div className="assistant-pick-thumb"><ProductVisual product={product} size="thumb" /></div>
                      <div className="assistant-pick-info">
                        <span className="assistant-pick-category">{product.category}</span>
                        <strong>{product.name}</strong>
                        <span className="assistant-pick-price">{formatPrice(product.price)}</span>
                      </div>
                      <button type="button" className="assistant-pick-add" onClick={() => onAdd(product)} data-testid={`assistant-match-${product.id}`}><Plus size={13} /> Add to bag</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="assistant-turn-meta">
                {message.createdAt && <time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))}</time>}
                {message.role === 'assistant' && index > 0 && !collectingName && !message.local && (
                  <button type="button" className="assistant-reply-btn" onClick={() => replyTo(message)} aria-label="Reply to this message" data-testid={`button-reply-${index}`}><CornerUpLeft size={12} /> Reply</button>
                )}
              </div>
            </div>
          ))}
          {pending && (
            <div className="assistant-turn assistant">
              <div className="assistant-message assistant assistant-thinking" data-testid="status-assistant-thinking"><span /><span /><span /> {pending === 'name' ? 'Starting your chat…' : 'Checking products and market sources…'}</div>
            </div>
          )}
        </div>
        {unread !== null && (
          <button type="button" className="assistant-new-pill" onClick={() => { scrollToMessage(unread); setUnread(null); }} data-testid="button-new-message">New message <ArrowDown size={13} /></button>
        )}

        <div className="assistant-panel-bottom">
          {!collectingName && !pending && messages.length <= 3 && messages[messages.length - 1]?.role === 'assistant' && (
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button type="button" className="suggestion" key={suggestion} onClick={() => void send(suggestion)} data-testid={`button-suggestion-${suggestion.toLowerCase().replaceAll(' ', '-')}`}>{suggestion}</button>
              ))}
            </div>
          )}
          {quote && (
            <div className="assistant-quote-chip" data-testid="quote-chip">
              <CornerUpLeft size={13} />
              <span><b>Replying to</b> {quote}</span>
              <button type="button" onClick={() => setQuote(null)} aria-label="Cancel reply"><X size={14} /></button>
            </div>
          )}
          <form className="assistant-input-row" onSubmit={submit}>
            <textarea
              ref={inputRef}
              className="assistant-input"
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }}
              placeholder={collectingName ? 'Your first name or nickname…' : 'Ask us anything'}
              maxLength={1000}
              aria-label={collectingName ? 'Your first name or nickname' : 'Message Ask Circuit'}
              data-testid="input-assistant-prompt"
            />
            <button className="send-button" type="submit" disabled={!prompt.trim() || !!pending} aria-label="Send" data-testid="button-send-prompt"><Send size={16} /></button>
          </form>
          {error && <p className="test-sessions-error" role="alert">{error}</p>}
          <p className="assistant-footnote">Chats and your chosen name are saved for a class research study. A nickname is fine; please don’t share sensitive personal details.</p>
        </div>
      </aside>
    </>
  );
}

function FacilitatorBar({ sessionId, onNewSession }: { sessionId: string; onNewSession: () => void }) {
  const [open, setOpen] = useState(true);
  const [participant, setParticipant] = useState('');
  const [savedParticipant, setSavedParticipant] = useState('');
  const [given, setGiven] = useState<{ card: string; time: string }[]>([]);
  const [status, setStatus] = useState<string>('');
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => { setGiven([]); setParticipant(''); setSavedParticipant(''); setStatus(''); }, [sessionId]);
  useEffect(() => {
    if (!confirmNew) return;
    const timer = window.setTimeout(() => setConfirmNew(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmNew]);

  const saveParticipant = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await postSessionEvent(sessionId, { type: 'participant', label: participant.trim() });
      setSavedParticipant(participant.trim());
      setStatus(participant.trim() ? `Participant saved: ${participant.trim()}` : 'Participant cleared');
    } catch {
      setStatus('Couldn’t save the participant. Check the connection and try again.');
    }
  };
  const giveCard = async (card: string) => {
    try {
      await postSessionEvent(sessionId, { type: 'card', card });
      const time = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      setGiven((current) => [...current, { card, time }]);
      setStatus(`Logged card ${card} at ${time}`);
    } catch {
      setStatus('Couldn’t log that card. Check the connection and tap it again.');
    }
  };

  return (
    <section className={`facilitator-bar${open ? ' is-open' : ''}`} aria-label="Facilitator controls" data-testid="facilitator-bar">
      <button type="button" className="facilitator-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} data-testid="button-facilitator-toggle">
        <span className="facilitator-flag">Facilitator</span>
        <span>{savedParticipant || 'No participant'} · {given.length} {given.length === 1 ? 'card' : 'cards'}</span>
        <ChevronRight size={14} className="facilitator-chevron" />
      </button>
      {open && (
        <div className="facilitator-body">
          <form className="facilitator-row" onSubmit={(event) => void saveParticipant(event)}>
            <label htmlFor="facilitator-participant">Participant</label>
            <input id="facilitator-participant" value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="e.g. P1" maxLength={60} data-testid="input-participant" />
            <button type="submit" data-testid="button-save-participant">Save</button>
          </form>
          <div className="facilitator-cards" role="group" aria-label="Log a card">
            {TEST_CARDS.map((card) => {
              const count = given.filter((item) => item.card === card).length;
              return (
                <button type="button" key={card} className={count ? 'is-given' : ''} onClick={() => void giveCard(card)} data-testid={`button-card-${card.slice(0, 2)}`}>
                  <b>{card.slice(0, 2)}</b>{card.slice(3)}{count > 1 && <em>×{count}</em>}
                </button>
              );
            })}
          </div>
          <div className="facilitator-foot">
            <span className="facilitator-status" role="status" data-testid="text-facilitator-status">{status || 'Tap a card when you hand it to the participant.'}</span>
            <button type="button" className={`facilitator-new${confirmNew ? ' is-confirm' : ''}`} onClick={() => { if (confirmNew) { setConfirmNew(false); onNewSession(); } else setConfirmNew(true); }} data-testid="button-new-session">
              {confirmNew ? 'Tap again to start' : 'New participant'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Renders the assistant's plain-text reply: paragraphs, "- " bullet lists, numbered lists and **bold**. */
export function FormattedReply({ text, sources = [] }: { text: string; sources?: Array<{ title: string; url: string }> }) {
  const inline = (value: string) => renderInline(value, sources);
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const bullet = /^[-•*]\s+/;
        const numbered = /^\d+[.)]\s+/;
        if (lines.every((line) => bullet.test(line))) {
          return <ul key={blockIndex}>{lines.map((line, i) => <li key={i}>{inline(line.replace(bullet, ''))}</li>)}</ul>;
        }
        if (lines.every((line) => numbered.test(line))) {
          return <ol key={blockIndex}>{lines.map((line, i) => <li key={i}>{inline(line.replace(numbered, ''))}</li>)}</ol>;
        }
        const firstBullet = lines.findIndex((line) => bullet.test(line));
        if (firstBullet > 0 && lines.slice(firstBullet).every((line) => bullet.test(line))) {
          return (
            <Fragment key={blockIndex}>
              <p>{lines.slice(0, firstBullet).map((line, i) => <Fragment key={i}>{i > 0 && ' '}{inline(line)}</Fragment>)}</p>
              <ul>{lines.slice(firstBullet).map((line, i) => <li key={i}>{inline(line.replace(bullet, ''))}</li>)}</ul>
            </Fragment>
          );
        }
        return <p key={blockIndex}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>;
      })}
    </>
  );
}

function renderInline(text: string, sources: Array<{ title: string; url: string }> = []): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const source = /^\[\d+\]$/.test(part) ? sources[Number(part.slice(1, -1)) - 1] : undefined;
    return source ? <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="assistant-citation">{part}</a> : <Fragment key={i}>{part}</Fragment>;
  });
}
