import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Banknote, Check, CreditCard, Landmark, ShieldCheck, ShoppingBag, Smartphone, Tag } from 'lucide-react';
import { useCart } from '@/cart';
import { useChat } from '@/chat/chat-context';
import { Header, SiteFooter } from '@/components/layout';
import { bagSavings } from '@/components/cart-drawer';
import { ProductImage } from '@/components/store-ui';
import { apiUrl, formatPrice } from '@/shared';

type Payment = 'UPI' | 'Card' | 'EMI' | 'COD';
const PAYMENTS: Array<{ id: Payment; label: string; note: string; icon: typeof Smartphone }> = [
  { id: 'UPI', label: 'UPI', note: 'Pay with any UPI app', icon: Smartphone },
  { id: 'Card', label: 'Credit or debit card', note: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'EMI', label: 'EMI', note: 'No Cost EMI for 6 months on orders above ₹10,000', icon: Landmark },
  { id: 'COD', label: 'Cash on delivery', note: 'Pay when it arrives', icon: Banknote },
];

type Order = { id: string; status: string; items: Array<{ id: string; name: string; quantity: number; price: number }>; total: number; delivery: string; payment: string; discount: number; pin: string };

/** Demo checkout: address + PIN (with delivery estimate), payment method, coupon, place order. Nothing is charged or shipped. */
export default function Checkout() {
  const cart = useCart();
  const chat = useChat();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState(() => { try { return localStorage.getItem('circuit-house-pincode') ?? ''; } catch { return ''; } });
  const [delivery, setDelivery] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment>('UPI');
  const [couponDraft, setCouponDraft] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pin)) { setDelivery(null); return; }
    let cancelled = false;
    fetch(apiUrl(`/shop/delivery?pin=${pin}`)).then((response) => response.json()).then((body: { label?: string; city?: string | null }) => {
      if (!cancelled && body.label) setDelivery(`${body.label}${body.city ? ` · ${body.city}` : ''}`);
      if (!cancelled && body.city && !city) setCity(body.city);
    }).catch(() => undefined);
    return () => { cancelled = true; };
    // only when the PIN changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const discount = coupon === 'CAMPUS5' ? Math.round(cart.subtotal * 0.05) : 0;
  const total = cart.subtotal - discount;
  const savings = bagSavings(cart.cart);

  const applyCoupon = (event: FormEvent) => {
    event.preventDefault();
    const code = couponDraft.trim().toUpperCase();
    if (!code) return;
    if (code === 'CAMPUS5' && cart.subtotal >= 3000) { setCoupon(code); setCouponMessage('CAMPUS5 applied: 5% off for students.'); }
    else if (code === 'CAMPUS5') { setCoupon(null); setCouponMessage('CAMPUS5 works on bags of ₹3,000 or more.'); }
    else { setCoupon(null); setCouponMessage('That code isn’t valid. Try CAMPUS5.'); }
  };

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !address.trim() || !city.trim() || !/^[1-9]\d{5}$/.test(pin)) {
      setError('Please fill in the name, address, city and a 6-digit PIN code.');
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch(apiUrl('/shop/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-chat-session': chat.sessionId },
        body: JSON.stringify({
          items: cart.cart.map((line) => ({ id: line.product.id, name: line.product.name, quantity: line.quantity, price: line.product.price, colour: line.colour ?? null })),
          address: { name: name.trim(), line: address.trim(), city: city.trim() },
          pin, payment, coupon,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The order couldn’t be placed.');
      setOrder(body as Order);
      cart.clear();
      window.scrollTo({ top: 0 });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The order couldn’t be placed.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="cx-store">
      <Header />
      <main className="cx-main ch-checkout">
        {order ? (
          <section className="ch-confirm" data-testid="order-confirmation">
            <div className="ch-confirm-icon"><Check size={28} /></div>
            <h1>Order placed</h1>
            <p>Your order ID is <b data-testid="text-order-id">{order.id}</b>. Keep it to check the order or ask Circuit about it.</p>
            <dl>
              <div><dt>Delivery</dt><dd>{order.delivery}</dd></div>
              <div><dt>Payment</dt><dd>{PAYMENTS.find((item) => item.id === order.payment)?.label ?? order.payment}</dd></div>
              <div><dt>Total</dt><dd>{formatPrice(order.total)}{order.discount ? ` (saved ${formatPrice(order.discount)} with CAMPUS5)` : ''}</dd></div>
            </dl>
            <ul className="ch-confirm-items">{order.items.map((item) => <li key={item.id}><span>{item.quantity} × {item.name}</span><b>{formatPrice(item.price * item.quantity)}</b></li>)}</ul>
            <p className="ch-muted ch-small">Demo store: no payment was taken and nothing will be shipped.</p>
            <Link href="/" className="ch-btn ch-btn-primary" data-testid="link-return-store">Continue shopping</Link>
          </section>
        ) : (
          <>
            <Link href="/" className="ch-back" data-testid="link-back-store"><ArrowLeft size={14} /> Back to the store</Link>
            <h1 className="ch-checkout-title">Checkout</h1>
            <div className="ch-demo-note"><ShieldCheck size={18} /><span><b>Demo checkout.</b> Use a made-up name and address. No payment details are asked for, nothing is charged and nothing is shipped.</span></div>
            {!cart.cart.length ? (
              <div className="cart-empty"><ShoppingBag size={26} /><strong>Your bag is empty.</strong><Link href="/" className="ch-btn ch-btn-secondary">Browse the store</Link></div>
            ) : (
              <form className="ch-checkout-grid" onSubmit={(event) => void placeOrder(event)}>
                <div className="ch-checkout-main">
                  <section className="ch-panel">
                    <h2>1. Delivery address</h2>
                    <div className="ch-fields">
                      <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="off" data-testid="input-name" /></label>
                      <label className="is-wide">Address<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={160} autoComplete="off" placeholder="House, street, area" data-testid="input-address" /></label>
                      <label>City<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={60} autoComplete="off" data-testid="input-city" /></label>
                      <label>PIN code<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="e.g. 560034" data-testid="input-pin" /></label>
                    </div>
                    {delivery && <p className="ch-status-good" data-testid="text-delivery-estimate">{delivery}</p>}
                  </section>
                  <section className="ch-panel">
                    <h2>2. Payment method</h2>
                    <div className="ch-pay" role="radiogroup" aria-label="Payment method">
                      {PAYMENTS.map(({ id, label, note, icon: Icon }) => (
                        <label key={id} className={payment === id ? 'is-selected' : ''}>
                          <input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} />
                          <Icon size={20} /><span><b>{label}</b><small>{note}</small></span>
                        </label>
                      ))}
                    </div>
                    <p className="ch-muted ch-small">In this demo you only choose a method. No card number or UPI ID is collected.</p>
                  </section>
                </div>
                <aside className="ch-panel ch-summary">
                  <h2>Order summary</h2>
                  <ul>{cart.cart.map((line) => (
                    <li key={line.product.id}><span className="ch-summary-thumb"><ProductImage product={line.product} sizes="thumb" /></span><span>{line.quantity} × {line.product.name}{line.colour ? <small>{line.colour}</small> : null}</span><b>{formatPrice(line.product.price * line.quantity)}</b></li>
                  ))}</ul>
                  <div className="ch-coupon">
                    <input value={couponDraft} onChange={(event) => setCouponDraft(event.target.value)} placeholder="Coupon code" aria-label="Coupon code" data-testid="input-coupon" />
                    <button type="button" className="ch-btn ch-btn-secondary" onClick={(event) => applyCoupon(event)} data-testid="button-apply-coupon">Apply</button>
                  </div>
                  {couponMessage && <p className={coupon ? 'ch-status-good' : 'ch-status-warn'} role="status">{couponMessage}</p>}
                  <dl className="ch-totals">
                    <div><dt>Items</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
                    {savings > 0 && <div><dt>Sale savings included</dt><dd>{formatPrice(savings)}</dd></div>}
                    {discount > 0 && <div><dt><Tag size={13} /> CAMPUS5</dt><dd>−{formatPrice(discount)}</dd></div>}
                    <div><dt>Delivery</dt><dd>Free</dd></div>
                    <div className="is-total"><dt>Total</dt><dd data-testid="text-checkout-total">{formatPrice(total)}</dd></div>
                  </dl>
                  {error && <p className="ch-status-warn" role="alert">{error}</p>}
                  <button type="submit" className="ch-btn ch-btn-primary ch-btn-block ch-btn-large" disabled={placing} data-testid="button-place-order">{placing ? 'Placing order…' : 'Place order'}</button>
                </aside>
              </form>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
