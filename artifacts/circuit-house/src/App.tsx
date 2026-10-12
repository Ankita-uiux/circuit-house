import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowDownUp, ArrowLeft, ArrowRight, Check, CheckCircle2, Headphones, Laptop, Minus, Plus, Search, Send, ShieldCheck, ShoppingBag, Sparkles, Truck, X } from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getListProductsQueryKey, useGetShoppingAssistantReply, useListProducts } from '@workspace/api-client-react';
import type { Product, ShoppingAssistantTurn } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
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
    { role: 'assistant', content: 'Tell me what you need your tech to do. I’ll narrow the shelf to a few things worth considering.' },
  ]);
  const [prompt, setPrompt] = useState('');
  const assistant = useGetShoppingAssistantReply();
  const categories = useMemo(() => ['Everything', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visibleProducts = useMemo(() => {
    let list = products.filter((product) => {
      const matchesCategory = category === 'Everything' || product.category === category;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [product.name, product.category, product.description, ...product.tags].join(' ').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
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
              <a href="#catalog" className="hero-cta" data-testid="link-explore-catalog">Find your next favorite <ArrowRight size={15} /></a>
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

        <section className="assistant-card" aria-label="Shopping assistant">
          <div className="assistant-inner">
            <div className="assistant-intro">
              <div className="assistant-kicker"><Sparkles size={12} /> A little help finding the right fit</div>
              <h2>Start with what<br />you actually need.</h2>
              <p>Our catalog guide matches your use, budget and priorities to products we carry. No outside recommendations.</p>
            </div>
            <div className="assistant-chat">
              <div className="assistant-heading"><span>Ask Circuit</span><span>Catalog-grounded guide</span></div>
              <div className="chat-messages" aria-live="polite" data-testid="assistant-conversation">
                {messages.map((message, index) => (
                  <div key={`${index}-${message.role}`}>
                    <div className={`chat-bubble ${message.role}`} data-testid={`message-${message.role}-${index}`}>{message.content}</div>
                    {!!message.products?.length && (
                      <div className="chat-match-list">
                        {message.products.map((product) => (
                          <button key={product.id} className="chat-match" onClick={() => addToCart(product)} data-testid={`assistant-match-${product.id}`}>
                            {product.name} · {formatPrice(product.price)} · add
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {assistant.isPending && <div className="chat-bubble">Looking through the catalog for a good fit…</div>}
              </div>
              <form className="chat-input-row" onSubmit={(event) => { event.preventDefault(); sendPrompt(); }}>
                <input className="chat-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="I need headphones for a long commute…" maxLength={1000} aria-label="Describe what you're shopping for" data-testid="input-assistant-prompt" />
                <button className="send-button" type="submit" disabled={!prompt.trim() || assistant.isPending} aria-label="Send question" data-testid="button-send-prompt"><Send size={16} /></button>
              </form>
              {messages.length === 1 && <div className="assistant-suggestions">
                {['A laptop for design school', 'Headphones for travel', 'A simple home speaker'].map((suggestion) => (
                  <button className="suggestion" key={suggestion} onClick={() => sendPrompt(suggestion)} data-testid={`button-suggestion-${suggestion.toLowerCase().replaceAll(' ', '-')}`}>{suggestion}</button>
                ))}
              </div>}
            </div>
          </div>
        </section>

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
              <option value="recommended">Sort: recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Top rated</option>
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
      <footer className="footer"><span>© Circuit House · A more considered kind of tech shop.</span><span>Clear choices, human advice.</span></footer>
      {cartOpen && <CartDrawer cart={cart} changeQuantity={changeQuantity} onClose={() => setCartOpen(false)} />}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className="product-card" data-testid={`card-product-${product.id}`}>
      <div className="product-image">
        {!imageFailed && product.image ? <img src={product.image} alt={product.name} onError={() => setImageFailed(true)} data-testid={`img-product-${product.id}`} /> : <div className="product-placeholder"><Laptop /></div>}
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </div>
      <div className="product-card-body">
        <div className="product-category">{product.category}</div>
        <h3>{product.name}</h3>
        <div className="product-description">{product.description}</div>
        <div className="rating-line"><span className="rating-stars" aria-label={`${product.rating} out of 5`}>★★★★★</span><span>{Number(product.rating).toFixed(1)}</span><span>({product.reviewCount} reviews)</span></div>
        <div className="product-card-bottom"><span className="price">{formatPrice(product.price)}</span><button className="add-button" onClick={onAdd} aria-label={`Add ${product.name} to cart`} data-testid={`button-add-${product.id}`}><Plus size={17} /></button></div>
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
            <div className="cart-thumb"><Laptop size={23} strokeWidth={1.3} /></div>
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

export default App;
