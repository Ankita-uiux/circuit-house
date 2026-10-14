import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, PhoneCall, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import type { ChatPreferences } from '@workspace/api-client-react';
import { FormattedReply } from './FormattedReply';
import type { ChatMessage, FeedbackInput } from './chat-context';

/* ---------- Thinking indicator: animated sparkle + changing word ---------- */
const THINKING_WORDS = ['Checking…', 'Finding…', 'Thinking…'];

export function ThinkingIndicator({ label }: { label?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (label) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % THINKING_WORDS.length), 1300);
    return () => window.clearInterval(timer);
  }, [label]);
  return (
    <div className="ch-thinking" role="status" aria-live="polite" data-testid="status-assistant-thinking">
      <Sparkles size={16} className="ch-thinking-icon" aria-hidden="true" />
      <b key={label ?? index}>{label ?? THINKING_WORDS[index]}</b>
    </div>
  );
}

/* ---------- A new reply appears word by word ---------- */
export function TypedReply({ text, animate, onDone }: { text: string; animate: boolean; onDone: () => void }) {
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(animate ? 0 : words.length);
  const done = useRef(!animate);
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(words.length); return; }
    const timer = window.setInterval(() => setShown((current) => Math.min(words.length, current + 2)), 28);
    return () => window.clearInterval(timer);
    // the text of a message never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);
  useEffect(() => {
    if (!done.current && shown >= words.length) { done.current = true; onDone(); }
  }, [shown, words.length, onDone]);
  const visible = shown >= words.length ? text : words.slice(0, shown).join('');
  return <FormattedReply text={visible} />;
}

/* ---------- Thumbs up / down under each reply ---------- */
export function FeedbackBar({ message, onFeedback, onOpenModal }: { message: ChatMessage; onFeedback: (input: FeedbackInput) => void; onOpenModal: () => void }) {
  const rating = message.feedback?.rating ?? null;
  return (
    <span className="ch-feedback" role="group" aria-label="Was this helpful?">
      <button type="button" className={rating === 'up' ? 'is-on' : ''} aria-pressed={rating === 'up'} aria-label="Helpful" title="Helpful" onClick={() => onFeedback({ rating: rating === 'up' ? null : 'up' })} data-testid={`button-thumbs-up-${message.id}`}><ThumbsUp size={15} /></button>
      <button type="button" className={rating === 'down' ? 'is-on' : ''} aria-pressed={rating === 'down'} aria-label="Not helpful" title="Not helpful" onClick={() => (rating === 'down' ? onFeedback({ rating: null }) : onOpenModal())} data-testid={`button-thumbs-down-${message.id}`}><ThumbsDown size={15} /></button>
    </span>
  );
}

export const FEEDBACK_REASONS = [
  "It didn't understand my question",
  "It didn't help me find what I needed",
  'It provided the wrong information',
  'The suggestions were confusing',
  'Too much effort to use',
  'Something else',
];

/** Thumbs down: "Help us improve Ask Circuit". Reasons are required; details are optional. */
export function FeedbackModal({ onCancel, onSend }: { onCancel: () => void; onSend: (input: FeedbackInput) => Promise<void> }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  const toggle = (reason: string) => setReasons((current) => (current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reasons.length) { setError('Please choose at least one reason.'); return; }
    setSending(true);
    try { await onSend({ rating: 'down', reasons, details: details.trim() }); }
    catch { setError('Your feedback couldn’t be saved. Please try again.'); setSending(false); }
  };
  return (
    <div className="ch-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <form className="ch-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onSubmit={(event) => void submit(event)} data-testid="modal-feedback">
        <button type="button" className="assistant-icon-btn is-filled ch-modal-close" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        <FeedbackIllustration />
        <h2 id="feedback-title">Help us improve Ask Circuit</h2>
        <p className="ch-muted">Your feedback makes Circuit House better for everyone.</p>
        <fieldset className="ch-modal-reasons">
          <legend>Why wasn’t the AI shopping assistant helpful? <span className="ch-required">(required)</span></legend>
          {FEEDBACK_REASONS.map((reason, index) => (
            <label key={reason}>
              <input ref={index === 0 ? firstRef : undefined} type="checkbox" checked={reasons.includes(reason)} onChange={() => { toggle(reason); setError(''); }} />
              <span>{reason}</span>
            </label>
          ))}
        </fieldset>
        <label className="ch-modal-details">
          Are there additional details you’d like to share about your experience?
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1500} rows={3} placeholder="Describe your experience…" data-testid="input-feedback-details" />
        </label>
        {error && <p className="ch-status-warn" role="alert">{error}</p>}
        <div className="ch-modal-actions">
          <button type="button" className="ch-btn ch-btn-quiet" onClick={onCancel}>Cancel</button>
          <button type="submit" className="ch-btn ch-btn-primary" disabled={sending} data-testid="button-send-feedback">{sending ? 'Sending…' : 'Send Feedback'}</button>
        </div>
      </form>
    </div>
  );
}

function FeedbackIllustration() {
  return (
    <svg className="ch-modal-art" viewBox="0 0 220 96" aria-hidden="true">
      <rect x="20" y="18" width="118" height="58" rx="16" fill="#e6faf5" />
      <path d="M44 76 l-8 16 22-16z" fill="#e6faf5" />
      <rect x="38" y="36" width="70" height="7" rx="3.5" fill="#14c8a0" />
      <rect x="38" y="50" width="48" height="7" rx="3.5" fill="#9fe8d6" />
      <rect x="112" y="8" width="88" height="50" rx="14" fill="#0e1114" />
      <path d="M180 58 l10 14 -22-14z" fill="#0e1114" />
      <path d="M137 33 l7 7 14-14" stroke="#14c8a0" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="170" cy="33" r="4" fill="#fff" /><circle cx="184" cy="33" r="4" fill="#fff" />
    </svg>
  );
}

/* ---------- Starter prompts after the name step ---------- */
export const STARTERS = ['Laptop', 'Phone', 'Headphones', 'Something else'];

/** Category options after the greeting (Stage 1), plus how the shopper likes to shop. */
export function StarterPrompts({ preferences, onMode, onPick }: { preferences: ChatPreferences; onMode: (mode: 'help-me-choose' | 'know-what-i-want') => void; onPick: (text: string) => void }) {
  return (
    <section className="ch-starters" aria-label="What are you shopping for?" data-testid="starter-prompts">
      <div className="ch-try-chips ch-starter-chips">
        {STARTERS.map((text) => (
          <button type="button" key={text} className="ch-try-chip" onClick={() => onPick(text)} data-testid={`button-starter-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{text}</button>
        ))}
      </div>
      <p className="ch-muted">How do you like to shop?</p>
      <div className="ch-mode" role="radiogroup" aria-label="How do you like to shop?">
        <button type="button" role="radio" aria-checked={preferences.mode === 'help-me-choose'} className={preferences.mode === 'help-me-choose' ? 'is-selected' : ''} onClick={() => onMode('help-me-choose')} data-testid="button-mode-help">Help me choose</button>
        <button type="button" role="radio" aria-checked={preferences.mode === 'know-what-i-want'} className={preferences.mode === 'know-what-i-want' ? 'is-selected' : ''} onClick={() => onMode('know-what-i-want')} data-testid="button-mode-know">I know what I want</button>
      </div>
    </section>
  );
}

/* ---------- "Try asking" chips after a reply ---------- */
/** Tappable options under a reply: answers to its question, action buttons, or "Try asking" follow-ups. */
export function TryAsking({ suggestions, asQuestion, onPick }: { suggestions: string[]; asQuestion: boolean; onPick: (text: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <div className="ch-try" data-testid="try-asking">
      {!asQuestion && <span className="ch-try-label"><Sparkles size={14} /> Try asking</span>}
      <div className="ch-try-chips">
        {suggestions.map((text) => <button type="button" key={text} className="ch-try-chip" onClick={() => onPick(text)} data-testid="chip-option">{!asQuestion && <ArrowUp size={12} />} {text}</button>)}
      </div>
    </div>
  );
}

/** "Compare all 3": side-by-side table, values that meet the shopper's needs in bold. */
export function ComparisonTable({ comparison }: { comparison: NonNullable<ChatMessage['comparison']> }) {
  return (
    <div className="ch-compare" data-testid="comparison-table">
      <table>
        <thead><tr><th scope="col"><span className="sr-only">Spec</span></th>{comparison.products.map((product) => <th scope="col" key={product.id}>{product.name}</th>)}</tr></thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => <td key={index} className={value.meetsRequirement ? 'is-good' : ''}>{value.meetsRequirement ? <b>{value.text}</b> : value.text}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Human request card ---------- */
export function HumanCard({ text }: { text: string }) {
  return (
    <div className="ch-human" role="status" data-testid="card-human">
      <span className="ch-human-icon"><PhoneCall size={20} /></span>
      <div><b>{text}</b><span>Keep this tab open. A Circuit House store expert is on the way.</span></div>
    </div>
  );
}

/* ---------- Reply length switch ---------- */
const LEVELS: Array<{ id: 'short' | 'normal' | 'detailed'; label: string }> = [
  { id: 'short', label: 'Short' }, { id: 'normal', label: 'Normal' }, { id: 'detailed', label: 'Detailed' },
];
export function VerbositySwitch({ value, onChange }: { value: 'short' | 'normal' | 'detailed'; onChange: (value: 'short' | 'normal' | 'detailed') => void }) {
  return (
    <div className="ch-segment" role="radiogroup" aria-label="Reply length">
      {LEVELS.map((level) => (
        <button type="button" key={level.id} role="radio" aria-checked={value === level.id} className={value === level.id ? 'is-selected' : ''} onClick={() => onChange(level.id)} data-testid={`button-verbosity-${level.id}`}>{level.label}</button>
      ))}
    </div>
  );
}
