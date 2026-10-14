import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useCart, type CartLine } from '@/cart';
import { formatPrice } from '@/shared';
import { ProductImage, rememberProducts, productHref } from './store-ui';

const FULFILMENT_LABEL = { pickup: 'Store pickup', delivery: 'Home delivery', shipping: 'Shipping' } as const;

/** Savings against MRP, shown as the offers applied in the bag. */
export function bagSavings(cart: CartLine[]) {
  return cart.reduce((sum, line) => sum + (line.product.mrp && line.product.mrp > line.product.price ? (line.product.mrp - line.product.price) * line.quantity : 0), 0);
}

/** The bag drawer. Opens from the header, the chat or a quantity stepper, above everything else. */
export function CartDrawer() {
  const cart = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cart.open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') cart.setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.open, cart]);
  if (!cart.open) return null;
  const savings = bagSavings(cart.cart);
  const close = () => cart.setOpen(false);
  return (
    <div className="cart-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <aside className="cart-drawer ch-drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title">
        <div className="drawer-top">
          <h2 id="bag-title">Your bag <span className="ch-muted">({cart.count})</span></h2>
          <button ref={closeRef} className="assistant-icon-btn is-filled" onClick={close} aria-label="Close bag" data-testid="button-close-cart"><X size={18} /></button>
        </div>
        {cart.cart.length ? (
          <>
            <ul className="drawer-items">
              {cart.cart.map((line) => (
                <li className="ch-bag-row" key={line.product.id}>
                  <Link href={productHref(line.product)} className="ch-bag-thumb" onClick={() => { rememberProducts([line.product]); close(); }}><ProductImage product={line.product} sizes="thumb" /></Link>
                  <div className="ch-bag-info">
                    <Link href={productHref(line.product)} className="ch-bag-name" onClick={() => { rememberProducts([line.product]); close(); }}>{line.product.name}</Link>
                    <span className="ch-muted">{[line.colour, line.fulfilment ? FULFILMENT_LABEL[line.fulfilment] : null].filter(Boolean).join(' · ') || line.product.brand}</span>
                    <span className="ch-bag-price">{formatPrice(line.product.price)}{line.product.mrp && line.product.mrp > line.product.price && <s>{formatPrice(line.product.mrp)}</s>}</span>
                    <div className="ch-qty">
                      <button type="button" onClick={() => cart.change(line.product.id, -1)} aria-label={line.quantity === 1 ? `Remove ${line.product.name}` : `Remove one ${line.product.name}`} data-testid={`button-decrease-${line.product.id}`}>{line.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                      <span aria-live="polite">{line.quantity}</span>
                      <button type="button" onClick={() => cart.change(line.product.id, 1)} aria-label={`Add one ${line.product.name}`} disabled={line.quantity >= 10} data-testid={`button-increase-${line.product.id}`}><Plus size={14} /></button>
                    </div>
                  </div>
                  <strong className="ch-bag-line-total">{formatPrice(line.product.price * line.quantity)}</strong>
                </li>
              ))}
            </ul>
            <div className="drawer-total ch-bag-total">
              <ul className="ch-bag-offers">
                {savings > 0 && <li><Tag size={14} /> Sale prices applied: you save {formatPrice(savings)}</li>}
                <li><Tag size={14} /> Free delivery on every order</li>
                <li><Tag size={14} /> Student code CAMPUS5 can be added at checkout</li>
              </ul>
              <div className="subtotal-line"><span>Total</span><strong data-testid="text-bag-total">{formatPrice(cart.subtotal)}</strong></div>
              <Link className="ch-btn ch-btn-primary ch-btn-block" href="/checkout" onClick={close} data-testid="link-checkout">Checkout <ArrowRight size={15} /></Link>
              <p className="ch-muted ch-small">Demo store: no payment is taken and nothing is shipped.</p>
            </div>
          </>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={29} />
            <strong>Your bag is empty.</strong>
            <p>Add something from the store or the chat and it will show up here.</p>
            <button className="ch-btn ch-btn-secondary" onClick={close} data-testid="button-continue-shopping">Keep shopping</button>
          </div>
        )}
      </aside>
    </div>
  );
}
