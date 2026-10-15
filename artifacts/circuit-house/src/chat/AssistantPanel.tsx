import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ChevronRight, CornerUpLeft, Headset, MessageCircle, Send, ShoppingCart, SquarePen, X } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { CHAT_INACTIVITY_MESSAGE, useChatInactivity } from '@/hooks/use-chat-inactivity';
import { formatPrice } from '@/shared';
import { useCart } from '@/cart';
import { ChooseOptionsSheet, ProductCarousel } from './ProductCards';
import { useChat, type ChatMessage } from './chat-context';
import { ComparisonTable, FeedbackBar, FeedbackModal, HumanCard, StarterPrompts, ThinkingIndicator, TryAsking, TypedReply, VerbositySwitch } from './ChatExtras';
import { FormattedReply } from './FormattedReply';
import { TEST_CARDS, postSessionEvent, readFacilitatorMode } from './session-events';

const COMPARE_ALL = 'Compare all';
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Floating button that opens the chat. Hidden while the panel is open. */
export function AssistantLauncher() {
  const { open, setOpen, messages } = useChat();
  if (open) return null;
  return (
    <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label="Open the shopping assistant" data-testid="button-open-assistant">
      <span className="assistant-fab-label">Ask Circuit</span>
      <MessageCircle size={30} strokeWidth={1.8} aria-hidden="true" />
      {messages.length > 1 && <span className="assistant-fab-dot" aria-hidden="true" />}
    </button>
  );
}

/**
 * The chat panel. It stays mounted while closed, so reopening it shows the same
 * conversation at the same scroll position.
 */
export function AssistantPanel() {
  const chat = useChat();
  const { open, setOpen, messages, pending, prompt, setPrompt, quote, setQuote, send, error, loading } = chat;
  const { toast } = useToast();
  const [facilitator] = useState(readFacilitatorMode);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const seen = useRef(messages.length);
  const userScrolled = useRef(false);
  const [unread, setUnread] = useState<number | null>(null);
  const collectingName = !chat.nameStepDone;
  const cart = useCart();
  const [sheet, setSheet] = useState<Product | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const finishAnimation = chat.finishAnimation;
  const doneHandlers = useRef(new Map<number, () => void>());
  const onDone = useCallback((index: number) => {
    let handler = doneHandlers.current.get(index);
    if (!handler) { handler = () => finishAnimation(index); doneHandlers.current.set(index, handler); }
    return handler;
  }, [finishAnimation]);
  const feedback = (messageId: number, input: Parameters<typeof chat.giveFeedback>[1]) =>
    chat.giveFeedback(messageId, input).catch(() => toast({ title: 'Feedback not saved', description: 'Please check your connection and try again.' }));
  const lastAssistantIndex = messages.reduce((last, message, index) => (message.role === 'assistant' ? index : last), -1);
  const shoppingStarted = messages.some((message, index) => message.role === 'user' && index > 1 && !/^(hi|hey|hello)\b/i.test(message.content)) || messages.some((message) => !!message.id);
  const showStarters = !collectingName && !pending && !loading && !shoppingStarted;
  const askAbout = (product: Product) => {
    setQuote(`${product.name} · ${formatPrice(product.price)}`);
    setPrompt('');
    inputRef.current?.focus();
  };

  // On wide screens the page makes room for the panel, so the chat sits beside it.
  useEffect(() => {
    document.documentElement.classList.toggle('chat-open', open);
    return () => document.documentElement.classList.remove('chat-open');
  }, [open]);

  useChatInactivity(open && chat.nameStepDone && !loading, !!pending, chat.sessionId, messages, () => {
    chat.pushLocal({ role: 'assistant', content: CHAT_INACTIVITY_MESSAGE });
    void postSessionEvent(chat.sessionId, { type: 'inactivity' }).catch(() => {
      toast({ title: 'Reminder could not be saved', description: 'The inactivity reminder appeared here, but could not be saved to the chat log.' });
    });
  });

  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || cart.open || feedbackFor !== null) return;
      if (sheet) setSheet(null); else setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen, sheet, cart.open, feedbackFor]);

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
      userScrolled.current = false;
      setUnread(null);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')));
      return;
    }
    const index = messages.length - 1;
    // Only a shopper who scrolled up by themselves (to read something) keeps their place.
    if (!userScrolled.current || nearBottom.current) {
      // The reply is laid out in full straight away. A reply taller than the chat opens at its first
      // line; a shorter one is simply shown at the bottom. Either way it is read from the start.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const list = listRef.current;
        const element = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
        if (!list || !element) return;
        if (element.offsetHeight > list.clientHeight - 24) scrollToMessage(index);
        else scrollToBottom();
      }));
    } else setUnread(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);


  useEffect(() => { if (pending && !userScrolled.current) requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto'))); }, [pending]);

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
  // Option chips: a few are app actions; the rest are sent as the shopper's reply.
  const pickOption = (text: string) => {
    const key = text.trim().toLowerCase();
    if (key === 'go to cart' || key === 'view cart') { cart.setOpen(true); return; }
    if (key === 'talk to store expert' || key === 'talk to a store expert') { chat.requestHuman(); return; }
    void send(text);
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
          <button type="button" className="assistant-icon-btn" onClick={chat.requestHuman} disabled={!!pending || collectingName} aria-label="Talk to store expert" title="Talk to store expert" data-testid="button-talk-to-expert"><Headset size={18} /></button>
          <button type="button" className="assistant-icon-btn assistant-bag-btn" onClick={() => cart.setOpen(true)} aria-label={`Open bag, ${cart.count} items`} title="Bag" data-testid="button-chat-bag"><ShoppingCart size={18} />{cart.count > 0 && <span className="cx-cart-count">{cart.count}</span>}</button>
          <button type="button" className="assistant-icon-btn" onClick={chat.newChat} disabled={!!pending} aria-label="Start a new chat" title="New chat" data-testid="button-new-chat"><SquarePen size={18} /></button>
          <button type="button" className="assistant-icon-btn is-filled" onClick={() => setOpen(false)} aria-label="Close the shopping assistant" title="Close" data-testid="button-close-assistant"><X size={18} /></button>
        </header>
        {!collectingName && (
          <div className="assistant-subbar">
            <span className="ch-muted">Replies</span>
            <VerbositySwitch value={chat.preferences.verbosity ?? 'normal'} onChange={(verbosity) => chat.setPreferences({ ...chat.preferences, verbosity })} />
          </div>
        )}
        {facilitator && <FacilitatorBar sessionId={chat.sessionId} onNewSession={chat.newParticipant} />}

        <div
          className="assistant-panel-messages" ref={listRef} onScroll={onScroll} aria-live="polite" data-testid="assistant-conversation"
          onWheel={(event) => { if (event.deltaY < 0) userScrolled.current = true; }}
          onTouchMove={() => { userScrolled.current = true; }}
          onPointerDown={(event) => { if (event.target === event.currentTarget) userScrolled.current = true; }}
          onKeyDown={(event) => { if (['PageUp', 'ArrowUp', 'Home'].includes(event.key)) userScrolled.current = true; }}
        >
          {messages.map((message, index) => {
            const isLatest = index === lastAssistantIndex;
            const ready = !message.animate;
            return (
              <div key={`${index}-${message.role}`} data-index={index} className={`assistant-turn ${message.role}`}>
                {message.quote && <div className="assistant-quote-in-turn"><CornerUpLeft size={12} /> <span>{message.quote}</span></div>}
                {message.kind === 'human' ? <HumanCard text={message.content} /> : (
                  <div className={`assistant-message ${message.role}`} data-testid={`message-${message.role}-${index}`}>
                    {message.role === 'assistant'
                      ? (message.animate ? <TypedReply text={message.content} animate onDone={onDone(index)} /> : <FormattedReply text={message.content} />)
                      : message.content}
                  </div>
                )}
                {(!!message.products?.length || !!message.comparison) && (
                  <div className={`ch-turn-extras${ready ? '' : ' is-waiting'}`}>
                    {!!message.products?.length && <ProductCarousel products={message.products} onChoose={setSheet} onAsk={askAbout} />}
                    {message.comparison && <ComparisonTable comparison={message.comparison} />}
                  </div>
                )}
                <div className="assistant-turn-meta">
                  {message.createdAt && <time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))}</time>}
                  {message.role === 'assistant' && message.id && ready && <FeedbackBar message={message} onFeedback={(input) => void feedback(message.id!, input)} onOpenModal={() => setFeedbackFor(message.id!)} />}
                  {message.role === 'assistant' && index > 0 && !collectingName && !message.local && ready && (
                    <button type="button" className="assistant-reply-btn" onClick={() => replyTo(message)} aria-label="Reply to this message" data-testid={`button-reply-${index}`}><CornerUpLeft size={12} /> Reply</button>
                  )}
                </div>
                {isLatest && ready && !pending && (() => {
                  // After exactly three product picks, always offer "Compare all" first.
                  const three = message.products?.length === 3 ? message.products.map((product) => product.id) : null;
                  const others = (message.suggestions ?? []).filter((text) => !(three && /^compare( all)?( 3| three)?$/i.test(text.trim())));
                  const chips = three ? [COMPARE_ALL, ...others] : others;
                  if (!chips.length) return null;
                  return <TryAsking suggestions={chips} asQuestion={!!three || /\?\s*$/.test(message.content.trim())} onPick={(text) => (three && text === COMPARE_ALL ? void send(COMPARE_ALL, { compareIds: three }) : pickOption(text))} />;
                })()}
              </div>
            );
          })}
          {showStarters && (
            <StarterPrompts preferences={chat.preferences} onMode={(mode) => chat.setPreferences({ ...chat.preferences, mode })} onPick={pickOption} />
          )}
          {pending && (
            <div className="assistant-turn assistant">
              <ThinkingIndicator label={pending === 'name' ? 'Starting your chat…' : undefined} />
            </div>
          )}
        </div>
        {unread !== null && (
          <button type="button" className="assistant-new-pill" onClick={() => { scrollToMessage(unread); setUnread(null); }} data-testid="button-new-message">New message <ArrowDown size={13} /></button>
        )}

        {sheet && <ChooseOptionsSheet product={sheet} onClose={() => setSheet(null)} />}
        {feedbackFor !== null && (
          <FeedbackModal
            onCancel={() => setFeedbackFor(null)}
            onSend={async (input) => {
              await chat.giveFeedback(feedbackFor, input);
              setFeedbackFor(null);
              toast({ title: 'Thanks for the feedback', description: 'It helps us improve Ask Circuit.' });
            }}
          />
        )}

        <div className="assistant-panel-bottom">
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

