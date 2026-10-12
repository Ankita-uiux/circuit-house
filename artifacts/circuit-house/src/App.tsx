import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowDownUp, ArrowLeft, ArrowRight, Check, CheckCircle2, Headphones, Laptop, Minus, Plus, Search, Send, ShieldCheck, ShoppingBag, Sparkles, Truck, X, MessageCircle, Smartphone, Tablet, Watch, Mouse, ExternalLink, type LucideIcon } from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getListProductsQueryKey, useGetShoppingAssistantReply, useListProducts } from '@workspace/api-client-react';
import type { Product, ShoppingAssistantTurn } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminPage from '@/pages/admin';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type CartLine = { product: Product; quantity: number };
type Message = { role: 'assistant' | 'user'; content: string; products?: Product[] };

function readCart(): CartLine[] {
  try {
    const saved = localStorage.getItem('circuit-house-cart');
    return saved ? JSON.parse(saved) as CartLine[] : [];
  } catch {
    return [];
  }
}

function App() {
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const updateCart = (next: CartLine[]) => {
    setCart(next);
    localStorage.setItem('circuit-house-cart', JSON.stringify(next));
  };
  const addToCart = (product: Product) => {
    const existing = cart.find((line) => line.product.id === product.id);
    updateCart(existing
      ? cart.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...cart, { product, quantity: 1 }]);
  };
  const changeQuantity = (id: string, amount: number) => {
    updateCart(cart.flatMap((line) => {
      if (line.product.id !== id) return [line];
      const quantity = line.quantity + amount;
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
  };
  const clearCart = () => updateCart([]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/">
                <Home cartCount={cartCount} addToCart={addToCart} cart={cart} changeQuantity={changeQuantity} cartOpen={cartOpen} setCartOpen={setCartOpen} />
              </Route>
              <Route path="/checkout">
                <Checkout cart={cart} clearCart={clearCart} />
              </Route>
              <Route path="/admin">
                <AdminPage />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Header({ count, onCart }: { count: number; onCart?: () => void }) {
  return (
    <>
      <div className="topline">Independent advice. Better gear. No guesswork.</div>
      <header className="site-header">
        <Link href="/" className="brand" data-testid="link-home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">circuit house</span>
        </Link>
        <nav className="header-center" aria-label="Store">
          <span>Thoughtful tech</span><span>Tested by people</span><span>Here when you need us</span>
        </nav>
        {onCart && <div className="header-actions">
          <button className="icon-button" aria-label="Open cart" onClick={onCart} data-testid="button-open-cart">
            <ShoppingBag size={17} strokeWidth={1.7} />
            {count > 0 && <span className="cart-count" data-testid="text-cart-count">{count}</span>}
          </button>
        </div>}
      </header>
    </>
  );
}

function Home({
  cartCount, addToCart, cart, changeQuantity, cartOpen, setCartOpen,
}: {
  cartCount: number;
  addToCart: (product: Product) => void;
  cart: CartLine[];
  changeQuantity: (id: string, amount: number) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}) {
  const productsQuery = useListProducts({ query: { queryKey: getListProductsQueryKey() } });
  const products = productsQuery.data ?? [];
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Everything');
  const [sort, setSort] = useState('recommended');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! Tell me what you’ll use it for and your budget.\n\nI’ll suggest a few options from our catalog and explain the trade-offs in plain words.' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistant = useGetShoppingAssistantReply();
  const categories = useMemo(() => ['Everything', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visibleProducts = useMemo(() => {
    let list = products.filter((product) => {
      const matchesCategory = category === 'Everything' || product.category === category;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [product.name, product.brand, product.category, product.description, ...product.specs, ...product.tags].join(' ').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'brand') list = [...list].sort((a, b) => a.brand.localeCompare(b.brand) || a.price - b.price);
    return list;
  }, [products, category, search, sort]);

  const sendPrompt = (value = prompt) => {
    const message = value.trim();
    if (!message || assistant.isPending) return;
    const history: ShoppingAssistantTurn[] = messages
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    const nextMessages: Message[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setPrompt('');
    assistant.mutate({ data: { message, history } }, {
      onSuccess: (reply) => setMessages((current) => [...current, { role: 'assistant', content: reply.reply, products: reply.products }]),
      onError: () => setMessages((current) => [...current, { role: 'assistant', content: 'I couldn’t reach the matching service just now. Try browsing the catalog or send that again in a moment.' }]),
    });
  };

  return (
    <div className="store-shell">
      <Header count={cartCount} onCart={() => setCartOpen(true)} />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">A better way to buy electronics</div>
              <h1 id="hero-title">Good gear.<br />Clear answers.</h1>
              <p>Tell us what matters. We’ll help you find the right thing, without the spec-sheet maze.</p>
              <div className="hero-actions">
                <a href="#catalog" className="hero-cta" data-testid="link-explore-catalog">Find your next favorite <ArrowRight size={15} /></a>
                <button type="button" className="hero-cta hero-cta-secondary" onClick={() => setAssistantOpen(true)} data-testid="button-hero-ask"><Sparkles size={14} /> Ask Circuit for help</button>
              </div>
            </div>
            <div className="hero-art" aria-label="Abstract illustration of carefully selected technology">
              <div className="orb" /><div className="orb-ring" /><div className="hero-device" />
              <span className="art-label">Useful by design · 01 / 04</span>
            </div>
          </div>
        </section>
        <div className="benefit-strip" aria-label="Store promises">
          <div className="benefit"><ShieldCheck size={15} /> Advice without the upsell</div>
          <div className="benefit"><CheckCircle2 size={15} /> Every pick earns its place</div>
          <div className="benefit"><Truck size={15} /> Straightforward delivery</div>
          <div className="benefit"><Headphones size={15} /> Real help, before and after</div>
        </div>

        <section className="shop-section" id="catalog">
          <div className="section-heading">
            <div><div className="eyebrow">The considered collection</div><h2>Good things, chosen well.</h2><p>Useful technology with the details that make a difference.</p></div>
            <label className="search-wrap"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, uses, or features" aria-label="Search products" data-testid="input-product-search" /></label>
          </div>
          <div className="shop-controls">
            <div className="category-tabs" aria-label="Filter by category">
              {categories.map((item) => <button key={item} className={`category-tab ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} data-testid={`button-category-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}
            </div>
            <label className="sort-select-wrap"><ArrowDownUp size={13} color="#738079" /><select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products" data-testid="select-product-sort">
              <option value="recommended">Sort: recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="brand">Brand: A to Z</option>
            </select></label>
          </div>
          {productsQuery.isLoading ? <ProductSkeleton /> : productsQuery.isError ? (
            <div className="error-state"><strong>Our shelves aren’t loading.</strong><p>Check your connection and give it another try.</p><button className="category-tab active" onClick={() => void productsQuery.refetch()} data-testid="button-retry-products">Try again</button></div>
          ) : products.length === 0 ? (
            <div className="empty-state"><Laptop size={25} /><strong>We’re restocking our digital shelves.</strong><p>There aren’t any products to show yet. Please check back soon.</p></div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state"><Search size={23} /><strong>No close matches this time.</strong><p>Try a broader search or choose a different category.</p><button className="category-tab" onClick={() => { setSearch(''); setCategory('Everything'); }} data-testid="button-reset-filters">Clear filters</button></div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}
            </div>
          )}
        </section>
      </main>
      <footer className="footer"><span>© Circuit House · A student class project, not a real store. Not affiliated with any brand shown.</span><span>Prices are reference prices from Indian retailers and tech sites, checked October 2026. Tap “Ref. price” on a product to see its source.</span></footer>
      {!assistantOpen && (
        <button type="button" className="assistant-fab" onClick={() => setAssistantOpen(true)} aria-label="Open the shopping assistant" data-testid="button-open-assistant">
          <MessageCircle size={19} strokeWidth={1.8} />
          <span>Ask Circuit</span>
          {messages.length > 1 && <span className="assistant-fab-dot" aria-hidden="true" />}
        </button>
      )}
      {assistantOpen && (
        <AssistantPanel
          messages={messages}
          prompt={prompt}
          setPrompt={setPrompt}
          pending={assistant.isPending}
          onSend={sendPrompt}
          onAdd={addToCart}
          onClose={() => setAssistantOpen(false)}
        />
      )}
      {cartOpen && <CartDrawer cart={cart} changeQuantity={changeQuantity} onClose={() => setCartOpen(false)} />}
    </div>
  );
}

const SUGGESTIONS = ['Laptop for Figma under ₹80,000', 'Phone under ₹30,000', 'Earbuds with ANC under ₹5,000'];

function AssistantPanel({
  messages, prompt, setPrompt, pending, onSend, onAdd, onClose,
}: {
  messages: Message[];
  prompt: string;
  setPrompt: (value: string) => void;
  pending: boolean;
  onSend: (value?: string) => void;
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="assistant-panel-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="assistant-panel" role="dialog" aria-labelledby="assistant-panel-title" data-testid="panel-assistant">
        <header className="assistant-panel-top">
          <div className="assistant-panel-mark" aria-hidden="true"><Sparkles size={15} /></div>
          <div className="assistant-panel-titles">
            <h2 id="assistant-panel-title">Ask Circuit</h2>
            <p>Honest picks from our catalog. No upsell.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close the shopping assistant" data-testid="button-close-assistant"><X size={17} /></button>
        </header>

        <div className="assistant-panel-messages" ref={listRef} aria-live="polite" data-testid="assistant-conversation">
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`assistant-turn ${message.role}`}>
              <div className={`assistant-message ${message.role}`} data-testid={`message-${message.role}-${index}`}>
                {message.role === 'assistant' ? <FormattedReply text={message.content} /> : message.content}
              </div>
              {!!message.products?.length && (
                <div className="assistant-picks">
                  {message.products.map((product) => (
                    <div key={product.id} className="assistant-pick">
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
            </div>
          ))}
          {pending && (
            <div className="assistant-turn assistant">
              <div className="assistant-message assistant assistant-thinking" data-testid="status-assistant-thinking"><span /><span /><span /> Looking through the catalog…</div>
            </div>
          )}
        </div>

        <div className="assistant-panel-bottom">
          {messages.length === 1 && (
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button type="button" className="suggestion" key={suggestion} onClick={() => onSend(suggestion)} data-testid={`button-suggestion-${suggestion.toLowerCase().replaceAll(' ', '-')}`}>{suggestion}</button>
              ))}
            </div>
          )}
          <form className="assistant-input-row" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
            <textarea
              ref={inputRef}
              className="assistant-input"
              rows={2}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }}
              placeholder="Tell me what it's for and your budget…"
              maxLength={1000}
              aria-label="Describe what you're shopping for"
              data-testid="input-assistant-prompt"
            />
            <button className="send-button" type="submit" disabled={!prompt.trim() || pending} aria-label="Send question" data-testid="button-send-prompt"><Send size={16} /></button>
          </form>
          <p className="assistant-footnote">Knows only the Circuit House catalog. Prices are reference prices from October 2026.</p>
        </div>
      </aside>
    </>
  );
}

/** Renders the assistant's plain-text reply: paragraphs, "- " bullet lists, numbered lists and **bold**. */
function FormattedReply({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const bullet = /^[-•*]\s+/;
        const numbered = /^\d+[.)]\s+/;
        if (lines.every((line) => bullet.test(line))) {
          return <ul key={blockIndex}>{lines.map((line, i) => <li key={i}>{renderInline(line.replace(bullet, ''))}</li>)}</ul>;
        }
        if (lines.every((line) => numbered.test(line))) {
          return <ol key={blockIndex}>{lines.map((line, i) => <li key={i}>{renderInline(line.replace(numbered, ''))}</li>)}</ol>;
        }
        // A paragraph followed by bullets in the same block
        const firstBullet = lines.findIndex((line) => bullet.test(line));
        if (firstBullet > 0 && lines.slice(firstBullet).every((line) => bullet.test(line))) {
          return (
            <Fragment key={blockIndex}>
              <p>{lines.slice(0, firstBullet).map((line, i) => <Fragment key={i}>{i > 0 && ' '}{renderInline(line)}</Fragment>)}</p>
              <ul>{lines.slice(firstBullet).map((line, i) => <li key={i}>{renderInline(line.replace(bullet, ''))}</li>)}</ul>
            </Fragment>
          );
        }
        return <p key={blockIndex}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{renderInline(line)}</Fragment>)}</p>;
      })}
    </>
  );
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Phones: Smartphone, Laptops: Laptop, Tablets: Tablet, Audio: Headphones, Wearables: Watch, Accessories: Mouse,
};

/** Product photo when one is set; otherwise a tile with the brand and a category icon. */
function ProductVisual({ product, size = 'card' }: { product: Product; size?: 'card' | 'thumb' }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (product.image && !imageFailed) {
    return <img src={product.image} alt={product.name} onError={() => setImageFailed(true)} data-testid={`img-product-${product.id}`} />;
  }
  const Icon = CATEGORY_ICONS[product.category] ?? ShoppingBag;
  return (
    <div className={`brand-tile brand-tile-${product.category.toLowerCase()} ${size === 'thumb' ? 'brand-tile-thumb' : ''}`} aria-hidden="true">
      <Icon strokeWidth={1.25} />
      {size === 'card' && <span>{product.brand}</span>}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="product-card" data-testid={`card-product-${product.id}`}>
      <div className="product-image">
        <ProductVisual product={product} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </div>
      <div className="product-card-body">
        <div className="product-category">{product.brand} · {product.category}</div>
        <h3>{product.name}</h3>
        <div className="product-description">{product.description}</div>
        <ul className="product-specs">
          {product.specs.slice(0, 3).map((spec) => <li key={spec}>{spec}</li>)}
        </ul>
        <div className="product-card-bottom">
          <div className="price-block">
            <span className="price">{formatPrice(product.price)}</span>
            <a className="price-source" href={product.priceSource.url} target="_blank" rel="noreferrer" title={`Reference price from ${product.priceSource.label}`} data-testid={`link-price-source-${product.id}`}>
              Ref. price · {product.priceSource.asOf} <ExternalLink size={9} />
            </a>
          </div>
          <button className="add-button" onClick={onAdd} aria-label={`Add ${product.name} to cart`} data-testid={`button-add-${product.id}`}><Plus size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return <div className="loading-grid" aria-label="Loading products">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-card"><div className="skeleton skeleton-media" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line" style={{ width: '40%' }} /></div>)}</div>;
}

function CartDrawer({ cart, changeQuantity, onClose }: { cart: CartLine[]; changeQuantity: (id: string, amount: number) => void; onClose: () => void }) {
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return (
    <div className="cart-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="cart-drawer" aria-label="Your cart">
        <div className="drawer-top"><h2>Your bag <span style={{ color: '#8a9588', font: '12px var(--app-font-mono)' }}>({cart.reduce((sum, line) => sum + line.quantity, 0)})</span></h2><button className="icon-button" onClick={onClose} aria-label="Close cart" data-testid="button-close-cart"><X size={17} /></button></div>
        {cart.length ? <>
          <div className="drawer-items">{cart.map(({ product, quantity }) => <div className="cart-row" key={product.id}>
            <div className="cart-thumb"><ProductVisual product={product} size="thumb" /></div>
            <div><h3>{product.name}</h3><small>{formatPrice(product.price)} each</small><div className="qty-controls"><button onClick={() => changeQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`} data-testid={`button-decrease-${product.id}`}><Minus size={12} /></button><span>{quantity}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label={`Add one ${product.name}`} data-testid={`button-increase-${product.id}`}><Plus size={12} /></button></div></div>
            <div className="cart-row-price">{formatPrice(product.price * quantity)}</div>
          </div>)}</div>
          <div className="drawer-total"><div className="subtotal-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><Link className="checkout-link" href="/checkout" onClick={onClose} data-testid="link-checkout">Continue to demo checkout <ArrowRight size={15} /></Link><div className="drawer-note">Taxes and delivery are not calculated in this demo.</div></div>
        </> : <div className="cart-empty"><ShoppingBag size={29} /><strong>Your bag is taking a breather.</strong><p>When something feels right, add it here and we’ll keep it safe.</p><button className="category-tab active" onClick={onClose} data-testid="button-continue-shopping">Keep looking</button></div>}
      </aside>
    </div>
  );
}

function Checkout({ cart, clearCart }: { cart: CartLine[]; clearCart: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const finishDemo = () => { setConfirmed(true); clearCart(); };
  return (
    <div className="checkout-page">
      <Header count={itemCount} />
      <main className="checkout-main">
        <Link href="/" className="checkout-back" data-testid="link-back-store"><ArrowLeft size={14} /> Back to the store</Link>
        <div className="checkout-grid">
          <div>
            <div className="eyebrow">The final check</div>
            <h1 className="checkout-title">Checkout,<br />without the charge.</h1>
            <p className="checkout-subtitle">This is a demo confirmation only. No card details, payment provider, or real order is involved.</p>
            <div className="demo-banner"><ShieldCheck size={18} /><div><strong>Demo checkout — no payment will be taken</strong>Press the confirmation button to see the completed demo state. Nothing is sent or charged.</div></div>
            <div style={{ color: '#7a8278', fontSize: 10, lineHeight: 1.7 }}>Circuit House offers clear, human guidance. This storefront preview demonstrates the shopping flow, not a live transaction.</div>
          </div>
          <section className="confirmation-card" aria-label="Order summary">
            {confirmed ? <div className="confirmed-state">
              <div className="confirmed-icon"><Check size={25} /></div>
              <h2>Demo complete.</h2>
              <p>Your sample checkout is confirmed. No order was placed and no payment was made. Your bag has been cleared.</p>
              <Link href="/" data-testid="link-return-store">Back to Circuit House <ArrowRight size={14} /></Link>
            </div> : <>
              <h2>Your order summary</h2>
              {!cart.length ? <div className="empty-state" style={{ padding: '28px 10px' }}><ShoppingBag size={22} /><strong>Your bag is empty.</strong><p>Explore the catalog and add something to see it here.</p><Link href="/" className="checkout-back" data-testid="link-empty-cart-store">Browse the store <ArrowRight size={13} /></Link></div> : <>
                {cart.map(({ product, quantity }) => <div className="checkout-product" key={product.id}><div><div className="checkout-product-name">{product.name}</div><div className="checkout-product-meta">Qty {quantity} · {product.category}</div></div><div className="checkout-product-price">{formatPrice(product.price * quantity)}</div></div>)}
                <div className="checkout-totals"><div><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div><span>Delivery</span><span>Not calculated</span></div><div className="grand"><span>Total in demo</span><span>{formatPrice(subtotal)}</span></div></div>
                <button className="demo-confirm" onClick={finishDemo} data-testid="button-confirm-demo">Confirm demo checkout — no payment</button>
                <div className="drawer-note">For demonstration only. This button does not process a payment.</div>
              </>}
            </>}
          </section>
        </div>
      </main>
      <footer className="footer"><span>© Circuit House · Demo storefront</span><span>No payment provider connected</span></footer>
    </div>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default App;
