import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, BatteryFull, Camera, Check, CircleDot, Cpu, Feather, Gauge, HardDrive, Headphones, IndianRupee, MemoryStick, Monitor, Package, PhoneCall, ShieldCheck, ShoppingCart, Sparkles, Star, Tag, Target, ThumbsDown, ThumbsUp, X, Zap, type LucideIcon } from 'lucide-react';
import type { ChatPreferences, Product } from '@workspace/api-client-react';
import { formatPrice } from '@/shared';
import { ProductImage, rememberedProduct } from '@/components/store-ui';
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
  // The whole reply is laid out at once (so the chat never has to follow a growing message);
  // it is then revealed from top to bottom, about as fast as a quick reader.
  const words = text.split(/\s+/).length;
  const duration = Math.min(2600, Math.max(500, words * 22));
  useEffect(() => {
    if (!animate) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(onDone, reduced ? 0 : duration);
    return () => window.clearTimeout(timer);
    // the text of a message never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);
  return (
    <div className={animate ? 'ch-reveal' : undefined} style={animate ? { animationDuration: `${duration}ms` } : undefined}>
      <FormattedReply text={text} />
    </div>
  );
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

/** Row label -> icon, so each spec reads at a glance. */
const ROW_ICONS: Array<[RegExp, LucideIcon]> = [
  [/price|cost/i, IndianRupee], [/processor|chip|cpu|soc/i, Cpu], [/ram|memory/i, MemoryStick], [/storage|ssd|rom/i, HardDrive],
  [/display|screen/i, Monitor], [/battery/i, BatteryFull], [/camera/i, Camera], [/best for|use|good for/i, Target],
  [/rating|review/i, Star], [/brand/i, Tag], [/weight/i, Feather], [/anc|noise|audio|sound|driver/i, Headphones],
  [/graphics|gpu/i, Gauge], [/charg/i, Zap], [/warranty/i, ShieldCheck],
];
const rowIcon = (label: string) => ROW_ICONS.find(([pattern]) => pattern.test(label))?.[1] ?? CircleDot;

/** "Compare all 3": side-by-side visual table. Photos up top, best fit highlighted, wins ticked. */
export function ComparisonTable({ comparison, onChoose }: { comparison: NonNullable<ChatMessage['comparison']>; onChoose?: (product: Product) => void }) {
  const full = comparison.products.map((product) => rememberedProduct(product.id));
  const bestIndex = full.findIndex((product) => product?.bestFit);
  const prices = comparison.products.map((product) => product.price);
  const maxPrice = Math.max(...prices, 1);
  const minPrice = Math.min(...prices);
  const wins = comparison.products.map((_, column) => comparison.rows.filter((row) => row.values[column]?.meetsRequirement).length);
  const col = (index: number) => (index === bestIndex ? 'is-best' : '');
  return (
    <div className="ch-compare" data-testid="comparison-table">
      <div className="ch-compare-head"><Sparkles size={14} /> Side by side <span>{comparison.products.length} picks · {comparison.rows.length} specs</span></div>
      <div className="ch-compare-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" className="ch-compare-corner"><span className="sr-only">Spec</span></th>
              {comparison.products.map((product, index) => {
                const known = full[index];
                return (
                  <th scope="col" key={product.id} className={col(index)}>
                    {index === bestIndex && <span className="ch-compare-ribbon">⭐ Best fit</span>}
                    <span className="ch-compare-thumb">{known ? <ProductImage product={known} sizes="thumb" /> : <Package size={26} strokeWidth={1.4} />}</span>
                    <span className="ch-compare-name">{product.name}</span>
                    <span className="ch-compare-price">{formatPrice(product.price)}</span>
                    <span className={`ch-compare-wins${wins[index] ? '' : ' is-none'}`} title="Specs that match what you asked for">{wins[index] > 0 && <Check size={11} strokeWidth={3} />} {wins[index]}/{comparison.rows.length} match</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => {
              const Icon = rowIcon(row.label);
              const isPrice = /price|cost/i.test(row.label);
              const isRating = /rating/i.test(row.label);
              return (
                <tr key={row.label}>
                  <th scope="row"><span className="ch-compare-label"><Icon size={14} aria-hidden="true" /> {row.label}</span></th>
                  {row.values.map((value, index) => {
                    const rating = isRating ? Number.parseFloat(value.text) : NaN;
                    return (
                      <td key={index} className={`${col(index)}${value.meetsRequirement ? ' is-good' : ''}`}>
                        <span className="ch-compare-value">
                          {value.meetsRequirement && <span className="ch-compare-tick" aria-label="Matches what you asked for"><Check size={11} strokeWidth={3} /></span>}
                          <span>{value.text}</span>
                        </span>
                        {isPrice && prices[index] !== undefined && (
                          <span className="ch-compare-bar" aria-hidden="true"><i className={prices[index] === minPrice ? 'is-low' : ''} style={{ width: `${Math.max(12, (prices[index] / maxPrice) * 100)}%` }} /></span>
                        )}
                        {isRating && rating > 0 && rating <= 5 && (
                          <span className="ch-compare-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={11} className={n <= Math.round(rating) ? 'is-on' : ''} />)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {onChoose && (
            <tfoot>
              <tr>
                <th scope="row"><span className="sr-only">Add</span></th>
                {comparison.products.map((product, index) => {
                  const known = full[index];
                  return (
                    <td key={product.id} className={col(index)}>
                      {known && <button type="button" className="ch-compare-add" onClick={() => onChoose(known)} data-testid={`button-compare-add-${product.id}`}><ShoppingCart size={13} /> Add</button>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="ch-compare-legend"><span className="ch-compare-tick"><Check size={10} strokeWidth={3} /></span> matches what you asked for</p>
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
