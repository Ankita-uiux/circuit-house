import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { MapPin, Search, ShoppingCart } from 'lucide-react';
import { useCart } from '@/cart';
import { useChat } from '@/chat/chat-context';

/** Header, logo and footer shared by every store page. */

export const CATEGORY_ORDER = ['Phones', 'Laptops', 'Tablets', 'Cameras', 'Gaming', 'TVs', 'Audio', 'Wearables', 'Accessories'] as const;

export function Logo() {
  return (
    <Link href="/" className="cx-logo" aria-label="Circuit House home" data-testid="link-home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--cx-accent)" />
        <path d="M21.5 10.2a7.6 7.6 0 1 0 0 11.6" fill="none" stroke="var(--cx-accent-ink)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="21.5" cy="10.2" r="2.3" fill="var(--cx-accent-ink)" />
        <circle cx="21.5" cy="21.8" r="2.3" fill="var(--cx-accent-ink)" />
      </svg>
      <span className="cx-logo-word">circuit<b>house</b></span>
    </Link>
  );
}

export function readPincode() {
  try { return localStorage.getItem('circuit-house-pincode') ?? ''; } catch { return ''; }
}

export function Header({
  search, onSearch, onSubmitSearch,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  onSubmitSearch?: () => void;
}) {
  const { count, setOpen } = useCart();
  const [pincode, setPincode] = useState(readPincode);
  const [pinOpen, setPinOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const savePincode = (event: FormEvent) => {
    event.preventDefault();
    if (draft.length !== 6) return;
    setPincode(draft);
    try { localStorage.setItem('circuit-house-pincode', draft); } catch { /* keep in memory */ }
    setPinOpen(false);
  };
  return (
    <header className="cx-header">
      <div className="cx-header-inner">
        <Logo />
        {onSearch ? (
          <form className="cx-search" role="search" onSubmit={(event) => { event.preventDefault(); onSubmitSearch?.(); }}>
            <input type="search" value={search ?? ''} onChange={(event) => onSearch(event.target.value)} placeholder="What are you looking for?" aria-label="Search products" data-testid="input-product-search" />
            <button type="submit" aria-label="Search"><Search size={18} /></button>
          </form>
        ) : <div className="cx-search-spacer" />}
        <div className="cx-header-actions">
          <div className="cx-pin-wrap">
            <button type="button" className="cx-pin" onClick={() => { setDraft(pincode); setPinOpen((open) => !open); }} aria-expanded={pinOpen} data-testid="button-pincode">
              <MapPin size={17} />
              <span>{pincode ? <>Deliver to <b>{pincode}</b></> : 'Select pincode'}</span>
            </button>
            {pinOpen && (
              <form className="cx-pin-pop" onSubmit={savePincode}>
                <label htmlFor="cx-pincode">Delivery pincode</label>
                <div className="cx-pin-row">
                  <input id="cx-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={draft} onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))} placeholder="e.g. 411001" data-testid="input-pincode" />
                  <button type="submit" disabled={draft.length !== 6}>Apply</button>
                </div>
                <p>Demo store: the pincode is only shown in the header.</p>
              </form>
            )}
          </div>
          <button className="cx-cart" aria-label={`Open bag, ${count} items`} onClick={() => setOpen(true)} data-testid="button-open-cart">
            <ShoppingCart size={21} />
            {count > 0 && <span className="cx-cart-count" data-testid="text-cart-count">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ onCategory }: { onCategory?: (category: string) => void }) {
  const chat = useChat();
  const onAsk = () => chat.setOpen(true);
  return (
    <footer className="cx-footer">
      <div className="cx-footer-inner">
        <div className="cx-footer-brand">
          <Logo />
          <p>A student class project that simulates shopping for electronics in India, with an AI shopping copilot. Not a real store.</p>
        </div>
        <nav aria-label="Shop by category">
          <h3>Shop</h3>
          <ul>
            {CATEGORY_ORDER.map((category) => (
              <li key={category}>{onCategory ? <button type="button" onClick={() => onCategory(category)}>{category}</button> : <Link href={`/?category=${encodeURIComponent(category)}`}>{category}</Link>}</li>
            ))}
          </ul>
        </nav>
        <div>
          <h3>Help</h3>
          <ul>
            <li><button type="button" onClick={onAsk}>Ask Circuit, our shopping copilot</button></li>
            <li><Link href="/checkout">Bag and demo checkout</Link></li>
          </ul>
        </div>
        <div>
          <h3>About this store</h3>
          <p>Prices are reference prices checked in October 2026. Stock, pickup, delivery, offers and orders are demo data: nothing is charged or shipped.</p>
        </div>
      </div>
      <div className="cx-footer-base">© 2026 Circuit House · Class project. Not affiliated with any brand or retailer shown.</div>
    </footer>
  );
}

