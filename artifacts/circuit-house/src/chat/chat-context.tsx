import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getShoppingAssistantReply } from '@workspace/api-client-react';
import type { ChatPreferences, Product, ShoppingAssistantReply } from '@workspace/api-client-react';
import { apiUrl, type CartLine } from '@/shared';

/**
 * One conversation per browser tab, saved on the server by session ID.
 * Closing the panel keeps it; refreshing reloads it from the server;
 * "New chat" starts a fresh one for the same participant.
 */

export type ChatMessage = {
  /** Saved message ID (assistant replies), used for feedback. */
  id?: number | null;
  role: 'assistant' | 'user';
  content: string;
  products?: Product[];
  market?: ShoppingAssistantReply['market'];
  /** For a user message: the earlier assistant message it replies to. */
  quote?: string;
  createdAt?: string;
  /** Shown locally only, e.g. a failed request notice. */
  local?: boolean;
  /** "human" replies are shown as a call-back card. */
  kind?: 'reply' | 'human' | 'off-topic';
  suggestions?: string[];
  feedback?: { rating: 'up' | 'down'; reasons?: string[]; details?: string } | null;
  /** A reply that just arrived: revealed word by word. */
  animate?: boolean;
  comparison?: ShoppingAssistantReply['comparison'];
  /** Product the assistant added to the cart in this reply. */
  cartAdd?: { id: string; name: string } | null;
};

export type FeedbackInput = { rating: 'up' | 'down' | null; reasons?: string[]; details?: string };

export const NAME_QUESTION = 'Hi! I’m your Circuit House shopping buddy 👋 Tell me what you need and your budget, and I’ll find the 3 best matches from our store. What should I call you?';
const GREETING: ChatMessage = { role: 'assistant', content: NAME_QUESTION };
const SESSION_KEY = 'circuit-house-chat-session';
const NAME_KEY = 'circuit-house-participant-name';

function newSessionId() {
  try { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID(); } catch { /* fall through */ }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function storageGet(key: string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* memory only */ }
}

type SendOptions = { quote?: string | null; deferred?: boolean; hidden?: boolean; requestHuman?: boolean; compareIds?: string[] };

type ChatContextValue = {
  sessionId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: ChatMessage[];
  participantName: string;
  /** The name step is over: a name was given, or the first reply was a shopping request. */
  nameStepDone: boolean;
  pending: 'name' | 'reply' | null;
  loading: boolean;
  error: string;
  prompt: string;
  setPrompt: (value: string) => void;
  quote: string | null;
  setQuote: (value: string | null) => void;
  preferences: ChatPreferences;
  setPreferences: (value: ChatPreferences) => void;
  send: (text?: string, options?: SendOptions) => Promise<void>;
  /** Opens the chat with a question, sending it when the participant has a name. */
  ask: (text: string) => void;
  newChat: () => void;
  newParticipant: () => void;
  /** Adds an assistant message on screen only (e.g. the inactivity reminder, which is logged separately). */
  pushLocal: (message: ChatMessage) => void;
  /** Saves thumbs up / down on a reply. */
  giveFeedback: (messageId: number, input: FeedbackInput) => Promise<void>;
  /** "Talk to store expert". */
  requestHuman: () => void;
  /** Marks a reply as fully shown (stops the word-by-word reveal). */
  finishAnimation: (index: number) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside ChatProvider');
  return value;
}

export function ChatProvider({ cart, onCartAdd, children }: { cart: CartLine[]; onCartAdd: (product: Product) => void; children: ReactNode }) {
  const [sessionId, setSessionId] = useState(() => storageGet(SESSION_KEY) ?? newSessionId());
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [participantName, setParticipantName] = useState('');
  const [nameSkipped, setNameSkipped] = useState(false);
  const nameStepDone = Boolean(participantName) || nameSkipped;
  const onCartAddRef = useRef(onCartAdd);
  onCartAddRef.current = onCartAdd;
  const [pending, setPending] = useState<'name' | 'reply' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ChatPreferences>({ verbosity: 'normal', mode: null });
  const queued = useRef<string | null>(null);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => { storageSet(SESSION_KEY, sessionId); }, [sessionId]);

  // Restore a saved conversation after a refresh.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/shop/chat-sessions/${encodeURIComponent(sessionId)}/conversation`), { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ participantName: string | null; nameStepDone?: boolean; preferences?: ChatPreferences; messages: Array<{ id: number; role: 'user' | 'assistant'; content: string; meta: Record<string, unknown>; createdAt: string }> }>;
      })
      .then((saved) => {
        if (cancelled) return;
        if (!saved || !saved.messages.length) {
          // A new chat for a participant we already know skips the name question.
          const known = storageGet(NAME_KEY);
          if (known && !saved?.participantName) void startWithName(known, true);
          return;
        }
        setParticipantName(saved.participantName ?? '');
        setNameSkipped(Boolean(saved.nameStepDone && !saved.participantName));
        if (saved.preferences) setPreferences({ verbosity: saved.preferences.verbosity ?? 'normal', mode: saved.preferences.mode ?? null });
        setMessages(saved.messages.map((row) => ({
          id: row.role === 'assistant' ? row.id : undefined,
          role: row.role,
          content: row.content,
          products: Array.isArray(row.meta?.products) ? row.meta.products as Product[] : undefined,
          market: row.meta?.market as ChatMessage['market'],
          quote: typeof row.meta?.quote === 'string' ? row.meta.quote : undefined,
          kind: row.meta?.kind === 'human' || row.meta?.kind === 'off-topic' ? row.meta.kind : undefined,
          suggestions: Array.isArray(row.meta?.suggestions) ? row.meta.suggestions as string[] : undefined,
          feedback: (row.meta?.feedback ?? null) as ChatMessage['feedback'],
          comparison: (row.meta?.comparison ?? null) as ChatMessage['comparison'],
          cartAdd: (row.meta?.cartAdd ?? null) as ChatMessage['cartAdd'],
          createdAt: row.createdAt,
        })));
      })
      .catch(() => { if (!cancelled) setError('Your earlier chat couldn’t be loaded. You can keep chatting here.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // startWithName is stable for a given session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const requestReply = useCallback(async (text: string, options: SendOptions = {}) => {
    setPending('reply');
    setError('');
    try {
      const history = messages.filter((message) => !message.local).slice(-12).map(({ role, content }) => ({ role, content }));
      const reply = await getShoppingAssistantReply({
        message: text,
        history,
        quote: options.quote ?? undefined,
        deferred: options.deferred || undefined,
        bag: cartRef.current.map(({ product, quantity }) => ({ id: product.id, name: product.name, quantity, price: product.price })),
        preferences,
        requestHuman: options.requestHuman || undefined,
        compareIds: options.compareIds?.length ? options.compareIds : undefined,
      }, { headers: { 'x-chat-session': sessionId } });
      setMessages((current) => [...current, {
        id: reply.messageId ?? null, role: 'assistant', content: reply.reply, products: reply.products, market: reply.market, createdAt: new Date().toISOString(),
        kind: reply.kind, suggestions: reply.suggestions, animate: reply.kind !== 'human',
        comparison: reply.comparison ?? null, cartAdd: reply.cartAdd ? { id: reply.cartAdd.id, name: reply.cartAdd.name } : null,
      }]);
      if (reply.cartAdd) onCartAddRef.current(reply.cartAdd);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', local: true, content: 'I couldn’t complete that request. Your message or reply may not have been saved. Please check your connection and try again.' }]);
    } finally {
      setPending(null);
    }
  }, [messages, preferences, sessionId]);

  const startWithName = useCallback(async (text: string, silent = false) => {
    setPending('name');
    setError('');
    try {
      const response = await fetch(apiUrl(`/shop/chat-sessions/${encodeURIComponent(sessionId)}/start`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
      });
      if (!response.ok) throw new Error('Name was not saved');
      const saved = await response.json() as { name: string | null; reply: string | null; pendingRequest: string | null; skipped?: boolean };
      const now = new Date().toISOString();
      if (saved.skipped && saved.pendingRequest) {
        // A shopping request instead of a name: carry on without a name and answer it.
        setNameSkipped(true);
        setMessages((current) => [...current, { role: 'user', content: text, createdAt: now }]);
        setPending(null);
        await requestReply(saved.pendingRequest, { deferred: true });
        return;
      }
      // A new chat for a known participant opens straight on the greeting.
      const greeting = saved.reply ?? '';
      if (silent) setMessages([{ role: 'assistant', content: greeting, createdAt: now }]);
      else setMessages((current) => [...current, { role: 'user', content: text, createdAt: now }, { role: 'assistant', content: greeting, createdAt: now }]);
      if (saved.name) {
        setParticipantName(saved.name);
        storageSet(NAME_KEY, saved.name);
      }
      setPending(null);
      const followUp = saved.pendingRequest ?? (saved.name ? queued.current : null);
      queued.current = null;
      if (saved.name && followUp) await requestReply(followUp, { deferred: Boolean(saved.pendingRequest) });
    } catch {
      setPending(null);
      setError('Your chat couldn’t be saved. Check your connection and send your name again.');
      if (!silent) setPrompt(text);
    }
  }, [requestReply, sessionId]);

  const send = useCallback(async (value?: string, options: SendOptions = {}) => {
    const text = (value ?? prompt).trim();
    if (!text || pending) return;
    if (value === undefined) setPrompt('');
    if (!nameStepDone) {
      if (value === undefined) setPrompt('');
      await startWithName(text);
      return;
    }
    const quoted = options.quote !== undefined ? options.quote : quote;
    setQuote(null);
    if (!options.hidden) {
      setMessages((current) => [...current, { role: 'user', content: text, quote: quoted ?? undefined, createdAt: new Date().toISOString() }]);
    }
    await requestReply(text, { ...options, quote: quoted });
  }, [nameStepDone, pending, prompt, quote, requestReply, startWithName]);

  const ask = useCallback((text: string) => {
    setOpen(true);
    if (nameStepDone) void send(text);
    else { queued.current = text; setPrompt(''); }
  }, [nameStepDone, send]);

  const reset = useCallback((keepName: boolean) => {
    if (pending) return;
    if (!keepName) { storageSet(NAME_KEY, null); setParticipantName(''); }
    else setParticipantName('');
    setNameSkipped(false);
    setMessages([GREETING]);
    setPrompt('');
    setQuote(null);
    setError('');
    queued.current = null;
    setSessionId(newSessionId());
  }, [pending]);

  const value = useMemo<ChatContextValue>(() => ({
    sessionId, open, setOpen, messages, participantName, nameStepDone, pending, loading, error, prompt, setPrompt, quote, setQuote,
    preferences,
    setPreferences: (next) => {
      setPreferences(next);
      void fetch(apiUrl(`/shop/chat-sessions/${encodeURIComponent(sessionId)}/events`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'preferences', verbosity: next.verbosity, mode: next.mode ?? null }),
      }).catch(() => undefined);
    },
    send, ask,
    newChat: () => reset(true),
    newParticipant: () => reset(false),
    pushLocal: (message) => setMessages((current) => [...current, { ...message, local: true, createdAt: new Date().toISOString() }]),
    giveFeedback: async (messageId, input) => {
      const previous = messages.find((message) => message.id === messageId)?.feedback ?? null;
      const next = input.rating ? { rating: input.rating, reasons: input.reasons, details: input.details } : null;
      setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, feedback: next } : message)));
      const response = await fetch(apiUrl(`/shop/chat-sessions/${encodeURIComponent(sessionId)}/feedback`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, ...input }),
      }).catch(() => null);
      if (!response?.ok) {
        setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, feedback: previous } : message)));
        throw new Error('Feedback not saved');
      }
    },
    requestHuman: () => { if (nameStepDone) void send('I’d like to talk to a store expert.', { requestHuman: true, quote: null }); },
    finishAnimation: (index) => setMessages((current) => current.map((message, i) => (i === index && message.animate ? { ...message, animate: false } : message))),
  }), [sessionId, open, messages, participantName, nameStepDone, pending, loading, error, prompt, quote, preferences, send, ask, reset]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
