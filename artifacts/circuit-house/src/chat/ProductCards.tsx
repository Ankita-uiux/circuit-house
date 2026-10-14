import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MessagesSquare, Package, PackageCheck as Ship, Store, Truck, X } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { useCart, type Fulfilment } from '@/cart';
import { BadgePill, PriceBlock, ProductImage, QuantityStepper, StarRating, StockBox, rememberProducts, useOpenProduct } from '@/components/store-ui';
import { apiUrl } from '@/shared';

/** Horizontal carousel of product cards inside a chat reply. */
export function ProductCarousel({ products, onChoose, onAsk }: { products: Product[]; onChoose: (product: Product) => void; onAsk: (product: Product) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const update = () => {
    const element = track.current;
    if (!element) return;
    setEdges({ start: element.scrollLeft < 8, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 8 });
  };
  useEffect(() => { rememberProducts(products); update(); }, [products]);
  const scroll = (direction: number) => track.current?.scrollBy({ left: direction * 220, behavior: 'smooth' });
  const list = products.slice(0, 4);
  return (
    <div className="ch-carousel">
      <div className="ch-carousel-track" ref={track} onScroll={update} data-testid="chat-carousel">
        {list.map((product) => <ChatProductCard key={product.id} product={product} onChoose={() => onChoose(product)} onAsk={() => onAsk(product)} />)}
      </div>
      {!edges.start && <button type="button" className="ch-carousel-arrow is-left" onClick={() => scroll(-1)} aria-label="Previous products"><ChevronLeft size={18} /></button>}
      {!edges.end && list.length > 1 && <button type="button" className="ch-carousel-arrow" onClick={() => scroll(1)} aria-label="More products" data-testid="button-carousel-next"><ChevronRight size={18} /></button>}
    </div>
  );
}

function ChatProductCard({ product, onChoose, onAsk }: { product: Product; onChoose: () => void; onAsk: () => void }) {
  const openProduct = useOpenProduct();
  const cart = useCart();
  const quantity = cart.quantityOf(product.id);
  return (
    <article className="ch-chat-card" data-testid={`chat-card-${product.id}`}>
      <button type="button" className="ch-media" onClick={() => openProduct(product)} aria-label={`Open ${product.name}`}>
        <ProductImage product={product} />
      </button>
      <div className="ch-chat-card-body">
        <BadgePill badge={product.badge} />
        <PriceBlock product={product} />
        <span className="ch-desc">{product.specs.slice(0, 2).join(' · ') || product.description}</span>
        <button type="button" className="ch-name" onClick={() => openProduct(product)} title={product.name}>{product.name}</button>
        <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        <StockBox product={product} />
        {quantity > 0
          ? <QuantityStepper quantity={quantity} label={product.name} onMinus={() => cart.change(product.id, -1)} onPlus={() => cart.change(product.id, 1)} onOpenBag={() => cart.setOpen(true)} />
          : <button type="button" className="ch-btn ch-btn-primary" onClick={onChoose} data-testid={`assistant-match-${product.id}`}>Add to cart</button>}
        <hr />
        <button type="button" className="ch-ask-link" onClick={onAsk} data-testid={`button-ask-about-${product.id}`}><MessagesSquare size={14} /> Ask about this product</button>
      </div>
    </article>
  );
}

const OTHER_STORES = ['Circuit House, Koramangala', 'Circuit House, Indiranagar', 'Circuit House, FC Road', 'Circuit House, Lower Parel', 'Circuit House, Connaught Place'];

/** "Choose options" sheet that opens inside the chat panel after Add to cart. */
export function ChooseOptionsSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const cart = useCart();
  const openProduct = useOpenProduct();
  const colours = product.colours ?? [];
  const [colour, setColour] = useState<string | null>(colours[0]?.name ?? null);
  const [fulfilment, setFulfilment] = useState<Fulfilment>('pickup');
  const [store, setStore] = useState(product.pickup?.store ?? OTHER_STORES[0]);
  const [storesOpen, setStoresOpen] = useState(false);
  const [pin, setPin] = useState(() => { try { return localStorage.getItem('circuit-house-pincode') ?? ''; } catch { return ''; } });
  const [delivery, setDelivery] = useState<string | null>(null);
  const quantity = cart.quantityOf(product.id);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const checkDelivery = async () => {
    if (!/^[1-9]\d{5}$/.test(pin)) { setDelivery('Enter a 6-digit PIN code.'); return; }
    try { localStorage.setItem('circuit-house-pincode', pin); } catch { /* memory only */ }
    const response = await fetch(apiUrl(`/shop/delivery?pin=${pin}`));
    const body = await response.json().catch(() => null) as { label?: string; city?: string | null } | null;
    setDelivery(body?.label ? `${body.label}${body.city ? ` to ${body.city}` : ''}` : 'Couldn’t check that PIN code.');
  };
  const low = product.stock?.status === 'low_stock';

  return (
    <div className="ch-sheet" role="dialog" aria-modal="true" aria-labelledby="ch-sheet-title" data-testid="sheet-choose-options">
      <header className="ch-sheet-head">
        <h3 id="ch-sheet-title">Choose options</h3>
        <button ref={closeRef} type="button" className="assistant-icon-btn is-filled" onClick={onClose} aria-label="Close options" data-testid="button-close-sheet"><X size={18} /></button>
      </header>
      <div className="ch-sheet-body">
        <div className="ch-sheet-product">
          <div className="ch-media"><ProductImage product={product} /></div>
          <div>
            <BadgePill badge={product.badge} />
            <button type="button" className="ch-sheet-name" onClick={() => openProduct(product)}>{product.name}</button>
            <span className="ch-sheet-brand">{product.brand}</span>
            <PriceBlock product={product} size="sheet" />
          </div>
        </div>

        {colours.length > 0 && (
          <fieldset className="ch-colours">
            <legend><b>Colour</b> {colour}</legend>
            <div>
              {colours.map((item) => (
                <button type="button" key={item.name} className={`ch-swatch${item.name === colour ? ' is-selected' : ''}`} style={{ background: item.hex }} onClick={() => setColour(item.name)} aria-label={item.name} aria-pressed={item.name === colour} title={item.name} />
              ))}
            </div>
          </fieldset>
        )}

        <div className="ch-fulfil" role="radiogroup" aria-label="How to get it">
          <button type="button" role="radio" aria-checked={fulfilment === 'pickup'} className={fulfilment === 'pickup' ? 'is-selected' : ''} onClick={() => setFulfilment('pickup')} data-testid="tile-pickup">
            <Store size={20} /><b>Pickup</b><span className="is-good">{product.pickup?.label ?? 'Ready within 2 hours'}</span>
          </button>
          <button type="button" role="radio" aria-checked={fulfilment === 'delivery'} className={fulfilment === 'delivery' ? 'is-selected' : ''} onClick={() => setFulfilment('delivery')} data-testid="tile-delivery">
            <Truck size={20} /><b>Delivery</b><span>{delivery && fulfilment === 'delivery' ? 'Checked' : 'Check availability'}</span>
          </button>
          <button type="button" role="radio" aria-checked={fulfilment === 'shipping'} className={fulfilment === 'shipping' ? 'is-selected' : ''} onClick={() => setFulfilment('shipping')} data-testid="tile-shipping">
            <Ship size={20} /><b>Shipping</b><span>{product.delivery?.label ?? 'Arrives in 3–5 days'}</span>
          </button>
        </div>

        {fulfilment === 'pickup' && (
          <div className="ch-pickup">
            <p>Pick up at <b>{store}</b> <button type="button" className="ch-link" onClick={() => setStoresOpen((value) => !value)} aria-expanded={storesOpen}>Check other stores</button></p>
            {storesOpen && (
              <ul className="ch-store-list">
                {OTHER_STORES.map((name) => <li key={name}><button type="button" className={name === store ? 'is-selected' : ''} onClick={() => { setStore(name); setStoresOpen(false); }}>{name}<span>{name === store ? 'Selected' : 'Ready within 2 hours'}</span></button></li>)}
              </ul>
            )}
            <p className="ch-status-good"><b>{product.pickup?.label ?? 'Ready within 2 hours'}</b> for pickup inside the store</p>
          </div>
        )}
        {fulfilment === 'delivery' && (
          <form className="ch-pin-check" onSubmit={(event) => { event.preventDefault(); void checkDelivery(); }}>
            <label htmlFor="ch-pin">Delivery PIN code</label>
            <div><input id="ch-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="e.g. 560034" /><button type="submit" className="ch-btn ch-btn-secondary">Check</button></div>
            {delivery && <p className="ch-status-good" role="status">{delivery}</p>}
          </form>
        )}
        {fulfilment === 'shipping' && <p className="ch-status-good"><b>{product.delivery?.label ?? 'Arrives in 3–5 days'}</b> with free shipping</p>}
        {low && <p className="ch-status-warn"><Package size={14} /> {product.stock?.label}</p>}

        {quantity > 0
          ? <QuantityStepper quantity={quantity} label={product.name} onMinus={() => cart.change(product.id, -1)} onPlus={() => cart.change(product.id, 1)} onOpenBag={() => cart.setOpen(true)} />
          : <button type="button" className="ch-btn ch-btn-primary ch-btn-block" onClick={() => cart.add(product, { colour, fulfilment })} data-testid="button-sheet-add">Add to cart</button>}
      </div>
    </div>
  );
}

