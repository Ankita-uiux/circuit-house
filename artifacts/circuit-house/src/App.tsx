import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Headphones, Laptop, MapPin, Minus, Plus, Search, Send, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, X, MessageCircle, Smartphone, Tablet, Watch, Mouse, ExternalLink, type LucideIcon } from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getListProductsQueryKey, useGetShoppingAssistantReply, useListProducts } from '@workspace/api-client-react';
import type { Product, ShoppingAssistantTurn } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { useToast } from '@/hooks/use-toast';
import { ChatArt, FestiveArt, LaptopArt, PhonesArt } from './banners';
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

const CATEGORY_ORDER = ['Phones', 'Laptops', 'Tablets', 'Audio', 'Wearables', 'Accessories'] as const;

const GREETING: Message = { role: 'assistant', content: 'Hi! Tell me what you’ll use it for and your budget.\n\nI’ll suggest a few options from our catalog and explain the trade-offs in plain words.' };

/* ---------- Saved chat sessions (for user testing) ---------- */
const SESSION_KEY = 'circuit-house-chat-session';
const FACILITATOR_KEY = 'circuit-house-facilitator';
export const TEST_CARDS = [
  '01 Everything at once', '02 Change your mind', '03 Off-topic',
  '04 Confused', '05 Wrong information', '06 Vague',
  '07 Ask for a human', '08 Hinglish and typos', '09 Silence',
] as const;

function newSessionId() {
  try { if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID(); } catch { /* fall through */ }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function readSessionId() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const created = newSessionId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return newSessionId();
  }
}
/** Facilitator mode: open the store with ?facilitator=1 (and ?facilitator=0 to turn it off). */
function readFacilitatorMode() {
  try {
    const flag = new URLSearchParams(window.location.search).get('facilitator');
    if (flag === '1') sessionStorage.setItem(FACILITATOR_KEY, '1');
    if (flag === '0') sessionStorage.removeItem(FACILITATOR_KEY);
    return sessionStorage.getItem(FACILITATOR_KEY) === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('facilitator') === '1';
  }
}
async function postSessionEvent(sessionId: string, event: { type: 'card'; card: string } | { type: 'participant'; label: string }) {
  const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/shop/chat-sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Event not saved (${response.status})`);
}

function Logo() {
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

function readPincode() {
  try { return localStorage.getItem('circuit-house-pincode') ?? ''; } catch { return ''; }
}

function Header({
  count, onCart, search, onSearch, onSubmitSearch,
}: {
  count: number;
  onCart?: () => void;
  search?: string;
  onSearch?: (value: string) => void;
  onSubmitSearch?: () => void;
}) {
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
          {onCart && (
            <button className="cx-cart" aria-label="Open cart" onClick={onCart} data-testid="button-open-cart">
              <ShoppingCart size={21} />
              {count > 0 && <span className="cx-cart-count" data-testid="text-cart-count">{count}</span>}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

type SlidePhoto = { src: string; alt: string; credit: string; creditUrl: string };
type Slide = { id: string; kicker: string; title: ReactNode; text: string; cta: string; tone: string; action: () => void; chips?: string[]; art?: ReactNode; photo?: SlidePhoto; finePrint?: string };

function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);
  if (!slides.length) return null;
  const slide = slides[index % slides.length];
  const go = (step: number) => setIndex((current) => (current + step + slides.length) % slides.length);
  const showPhoto = Boolean(slide.photo && !brokenPhotos[slide.id]);
  return (
    <section className="cx-hero" aria-roledescription="carousel" aria-label="Featured" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className={`cx-slide cx-slide-${slide.tone}${showPhoto ? ' has-photo' : ''}`} key={slide.id} aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
        {showPhoto && slide.photo && (
          <div className="cx-slide-photo">
            <img src={slide.photo.src} alt={slide.photo.alt} onError={() => setBrokenPhotos((current) => ({ ...current, [slide.id]: true }))} data-testid={`img-hero-${slide.id}`} />
            <a className="cx-photo-credit" href={slide.photo.creditUrl} target="_blank" rel="noreferrer">Photo: {slide.photo.credit} / Unsplash</a>
          </div>
        )}
        <div className="cx-slide-copy">
          <span className="cx-slide-kicker">{slide.kicker}</span>
          <h1>{slide.title}</h1>
          <p>{slide.text}</p>
          {slide.chips && <ul className="cx-slide-chips">{slide.chips.map((chip) => <li key={chip}>{chip}</li>)}</ul>}
          <button type="button" className="cx-slide-cta" onClick={slide.action} data-testid={`button-hero-${slide.id}`}>{slide.cta} <ArrowRight size={16} /></button>
        </div>
        {!showPhoto && slide.art && <div className="cx-slide-art" aria-hidden="true">{slide.art}</div>}
        {slide.finePrint && <span className="cx-slide-fine">{slide.finePrint}</span>}
      </div>
      <button type="button" className="cx-hero-arrow cx-hero-prev" onClick={() => go(-1)} aria-label="Previous offer"><ChevronLeft size={20} /></button>
      <button type="button" className="cx-hero-arrow cx-hero-next" onClick={() => go(1)} aria-label="Next offer"><ChevronRight size={20} /></button>
      <div className="cx-hero-dots">
        {slides.map((item, dot) => <button type="button" key={item.id} className={dot === index ? 'active' : ''} onClick={() => setIndex(dot)} aria-label={`Show offer ${dot + 1}`} aria-current={dot === index} />)}
      </div>
    </section>
  );
}

function ProductRow({
  id, title, subtitle, products, onAdd, onViewAll,
}: {
  id: string;
  title: string;
  subtitle?: string;
  products: Product[];
  onAdd: (product: Product) => void;
  onViewAll?: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: 'smooth' });
  };
  if (!products.length) return null;
  return (
    <section className="cx-row" id={`row-${id}`} aria-labelledby={`row-title-${id}`}>
      <div className="cx-row-head">
        <div>
          <h2 id={`row-title-${id}`}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="cx-row-tools">
          {onViewAll && <button type="button" className="cx-viewall" onClick={onViewAll} data-testid={`button-viewall-${id}`}>View all</button>}
          <button type="button" className="cx-round" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}><ChevronLeft size={18} /></button>
          <button type="button" className="cx-round" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="cx-row-track" ref={track}>
        {products.map((product) => <ProductCard key={product.id} product={product} onAdd={() => onAdd(product)} context={id} />)}
      </div>
    </section>
  );
}

function SiteFooter({ onAsk, onCategory }: { onAsk?: () => void; onCategory?: (category: string) => void }) {
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
              <li key={category}>{onCategory ? <button type="button" onClick={() => onCategory(category)}>{category}</button> : <Link href="/">{category}</Link>}</li>
            ))}
          </ul>
        </nav>
        <div>
          <h3>Help</h3>
          <ul>
            {onAsk && <li><button type="button" onClick={onAsk}>Ask Circuit, our shopping copilot</button></li>}
            <li><Link href="/checkout">Cart and demo checkout</Link></li>
          </ul>
        </div>
        <div>
          <h3>About prices</h3>
          <p>Prices are reference prices from Indian retailers and tech sites, checked October 2026. Tap “Ref. price” on any product to see its source.</p>
        </div>
      </div>
      <div className="cx-footer-base">© 2026 Circuit House · Class project. Not affiliated with any brand or retailer shown.</div>
    </footer>
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
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Everything');
  const [sort, setSort] = useState('recommended');
  const [messages, setMessages] = useState<Message[]>([
    GREETING,
  ]);
  const [prompt, setPrompt] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sessionId, setSessionId] = useState(readSessionId);
  const [facilitator] = useState(readFacilitatorMode);
  const assistant = useGetShoppingAssistantReply({ request: { headers: { 'x-chat-session': sessionId } } });
  const startNewSession = () => {
    const id = newSessionId();
    try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* memory only */ }
    setSessionId(id);
    setMessages([GREETING]);
    setPrompt('');
  };
  const catalogRef = useRef<HTMLElement>(null);

  const goToCatalog = () => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToRow = (id: string) => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const showCategory = (value: string) => { setCategory(value); setSearch(''); goToCatalog(); };
  const add = (product: Product) => {
    addToCart(product);
    toast({ title: 'Added to cart', description: product.name });
  };

  const categories = useMemo(() => ['Everything', ...CATEGORY_ORDER.filter((item) => products.some((product) => product.category === item))], [products]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = products.filter((product) => {
      const matchesCategory = category === 'Everything' || product.category === category;
      const matchesSearch = !query || [product.name, product.brand, product.category, product.description, ...product.specs, ...product.tags].join(' ').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'brand') list = [...list].sort((a, b) => a.brand.localeCompare(b.brand) || a.price - b.price);
    return list;
  }, [products, category, search, sort]);

  const rows = useMemo(() => {
    const byPrice = (a: Product, b: Product) => a.price - b.price;
    return {
      laptops: products.filter((product) => product.category === 'Laptops').sort(byPrice),
      phones: products.filter((product) => product.category === 'Phones' && product.price < 30000).sort(byPrice),
      audio: products.filter((product) => product.category === 'Audio').sort(byPrice),
      tablets: products.filter((product) => product.category === 'Tablets' || product.category === 'Wearables').sort(byPrice),
    };
  }, [products]);

  const minIn = (list: Product[]) => (list.length ? Math.min(...list.map((product) => product.price)) : null);
  const priceOf = (id: string) => products.find((product) => product.id === id)?.price;
  const fromText = (value: number | null | undefined) => (value ? formatPrice(value) : '');
  const laptopFrom = minIn(rows.laptops);
  const phones20k = products.filter((product) => product.category === 'Phones' && product.price < 20000);
  const phoneFrom = minIn(phones20k);
  const earbudsFrom = minIn(products.filter((product) => product.category === 'Audio' && product.tags.includes('earbuds')));
  const neoPrice = priceOf('macbook-neo');
  const loqPrice = priceOf('lenovo-loq-rtx5060');
  const maxBattery = Math.max(0, ...phones20k.map((product) => Number(product.specs.join(' ').match(/(\d{4,5})mAh/)?.[1] ?? 0)));
  const fine = '*Reference prices from Indian retailers, checked Oct 2026';

  const slides: Slide[] = [
    {
      id: 'fest', tone: 'festive', kicker: 'Festive Tech Fest',
      title: <>Light up Diwali<br />with new tech</>,
      text: 'Laptops, phones and earbuds for college and home, compared honestly.',
      chips: [laptopFrom ? `Laptops from ${fromText(laptopFrom)}*` : '', phoneFrom ? `5G phones from ${fromText(phoneFrom)}*` : '', earbudsFrom ? `Earbuds from ${fromText(earbudsFrom)}*` : ''].filter(Boolean),
      cta: 'Shop the fest', action: goToCatalog, art: <FestiveArt />, finePrint: fine,
      photo: {
        src: 'https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&w=1400&q=80',
        alt: 'A smartphone held up against glowing festive lights',
        credit: 'Rodion Kutsaiev', creditUrl: 'https://unsplash.com/photos/person-holding-smartphone-0VGG7cqTwCo',
      },
    },
    {
      id: 'laptops', tone: 'teal', kicker: 'Back to college',
      title: <>Laptops for<br />every course</>,
      text: 'Coding, design or video editing: pick by what you’ll actually do on it.',
      chips: [
        laptopFrom ? `16GB RAM from ${fromText(laptopFrom)}*` : '',
        neoPrice ? `MacBook Neo ${fromText(neoPrice)}*` : '',
        loqPrice ? `RTX 5060 gaming ${fromText(loqPrice)}*` : '',
      ].filter(Boolean),
      cta: 'Shop laptops', action: () => showCategory('Laptops'), art: <LaptopArt />, finePrint: fine,
    },
    {
      id: 'phones', tone: 'violet', kicker: 'Smart buys',
      title: <>5G phones<br />under ₹20,000</>,
      text: 'Samsung, POCO, iQOO, Motorola and more, all with 5000mAh or bigger batteries.',
      chips: [phoneFrom ? `From ${fromText(phoneFrom)}*` : '', maxBattery ? `Up to ${maxBattery.toLocaleString('en-IN')}mAh battery` : '', '120Hz screens available'].filter(Boolean),
      cta: 'See phones', action: () => goToRow('phones'), art: <PhonesArt />, finePrint: fine,
      photo: {
        src: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?auto=format&fit=crop&w=1400&q=80',
        alt: 'A hand holding an Android smartphone',
        credit: 'Daniel Romero', creditUrl: 'https://unsplash.com/photos/person-holding-black-android-smartphone-aiUAxBNe3Xk',
      },
    },
    {
      id: 'copilot', tone: 'navy', kicker: 'New · AI shopping copilot',
      title: <>Not sure what to buy?<br />Ask Circuit.</>,
      text: 'Tell it what you’ll use it for and your budget. It suggests options from our catalog and explains the trade-offs.',
      chips: ['No upsell', 'Plain-language answers', 'Only products we stock'],
      cta: 'Ask Circuit', action: () => setAssistantOpen(true),
      art: <ChatArt productName="MacBook Neo" price={fromText(neoPrice) || '₹69,900'} />,
    },
  ];

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

  const heading = search.trim() ? `Results for “${search.trim()}”` : category === 'Everything' ? 'All products' : category;

  return (
    <div className="cx-store">
      <Header count={cartCount} onCart={() => setCartOpen(true)} search={search} onSearch={setSearch} onSubmitSearch={goToCatalog} />
      <main className="cx-main">
        <HeroCarousel slides={slides} />

        <section className="cx-cats" aria-label="Shop by category">
          {CATEGORY_ORDER.map((item) => {
            const Icon = CATEGORY_ICONS[item];
            return (
              <button type="button" key={item} className="cx-cat" onClick={() => showCategory(item)} data-testid={`button-cat-circle-${item.toLowerCase()}`}>
                <span className="cx-cat-circle"><Icon strokeWidth={1.4} /></span>
                <span className="cx-cat-label">{item}</span>
              </button>
            );
          })}
        </section>

        {productsQuery.isSuccess && (
          <>
            <ProductRow id="laptops" title="Laptops for college" subtitle="Sorted by price, from budget Windows to MacBook Pro." products={rows.laptops} onAdd={add} onViewAll={() => showCategory('Laptops')} />
            <ProductRow id="phones" title="Phones under ₹30,000" subtitle="Big batteries and AMOLED screens for less." products={rows.phones} onAdd={add} onViewAll={() => showCategory('Phones')} />
            <ProductRow id="audio" title="Earbuds, headphones and speakers" subtitle="Noise cancellation from ₹1,199." products={rows.audio} onAdd={add} onViewAll={() => showCategory('Audio')} />
            <ProductRow id="tablets" title="Tablets and smartwatches" subtitle="For notes, classes and staying on track." products={rows.tablets} onAdd={add} />
          </>
        )}

        <section className="cx-catalog" id="catalog" ref={catalogRef} aria-labelledby="catalog-title">
          <div className="cx-catalog-head">
            <div>
              <h2 id="catalog-title">{heading}</h2>
              {productsQuery.isSuccess && <p>{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}</p>}
            </div>
            <label className="cx-sort">
              <span>Sort by</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products" data-testid="select-product-sort">
                <option value="recommended">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="brand">Brand: A to Z</option>
              </select>
            </label>
          </div>
          <div className="cx-chips" role="group" aria-label="Filter by category">
            {categories.map((item) => (
              <button type="button" key={item} className={`cx-chip ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)} data-testid={`button-category-${item.toLowerCase().replaceAll(' ', '-')}`}>{item === 'Everything' ? 'All' : item}</button>
            ))}
          </div>
          {productsQuery.isLoading ? <ProductSkeleton /> : productsQuery.isError ? (
            <div className="cx-empty"><strong>Products aren’t loading.</strong><p>Check your connection and try again.</p><button type="button" className="cx-chip active" onClick={() => void productsQuery.refetch()} data-testid="button-retry-products">Try again</button></div>
          ) : products.length === 0 ? (
            <div className="cx-empty"><strong>No products yet.</strong><p>Please check back soon.</p></div>
          ) : visibleProducts.length === 0 ? (
            <div className="cx-empty"><strong>No matches for that search.</strong><p>Try a brand, a category or a spec like “RTX” or “ANC”.</p><button type="button" className="cx-chip active" onClick={() => { setSearch(''); setCategory('Everything'); }} data-testid="button-reset-filters">Clear filters</button></div>
          ) : (
            <div className="cx-grid">
              {visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => add(product)} />)}
            </div>
          )}
        </section>
      </main>
      <SiteFooter onAsk={() => setAssistantOpen(true)} onCategory={showCategory} />
      {!assistantOpen && (
        <button type="button" className="assistant-fab" onClick={() => setAssistantOpen(true)} aria-label="Open the shopping assistant" data-testid="button-open-assistant">
          <MessageCircle size={20} strokeWidth={2} />
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
          onAdd={add}
          onClose={() => setAssistantOpen(false)}
          facilitator={facilitator}
          sessionId={sessionId}
          onNewSession={startNewSession}
        />
      )}
      {cartOpen && <CartDrawer cart={cart} changeQuantity={changeQuantity} onClose={() => setCartOpen(false)} />}
    </div>
  );
}

const SUGGESTIONS = ['Laptop for Figma under ₹80,000', 'Phone under ₹30,000', 'Earbuds with ANC under ₹5,000'];

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

function AssistantPanel({
  messages, prompt, setPrompt, pending, onSend, onAdd, onClose, facilitator, sessionId, onNewSession,
}: {
  messages: Message[];
  prompt: string;
  setPrompt: (value: string) => void;
  pending: boolean;
  onSend: (value?: string) => void;
  onAdd: (product: Product) => void;
  onClose: () => void;
  facilitator: boolean;
  sessionId: string;
  onNewSession: () => void;
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
        {facilitator && <FacilitatorBar sessionId={sessionId} onNewSession={onNewSession} />}

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
          <p className="assistant-footnote">Knows only the Circuit House catalog. Chats are saved for a class research study, so please don’t share personal details.</p>
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
    const credit = product.imageCredit;
    return (
      <>
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" onError={() => setImageFailed(true)} data-testid={`img-product-${product.id}`} />
        {credit && size === 'card' && (
          <a className="cx-photo-credit" href={credit.sourceUrl} target="_blank" rel="noreferrer" title={`Photo: ${credit.author}, ${credit.license}, via Wikimedia Commons`} data-testid={`link-photo-credit-${product.id}`}>
            Photo: {credit.author} · {credit.license}
          </a>
        )}
      </>
    );
  }
  const Icon = CATEGORY_ICONS[product.category] ?? ShoppingBag;
  return (
    <div className={`brand-tile brand-tile-${product.category.toLowerCase()} ${size === 'thumb' ? 'brand-tile-thumb' : ''}`} aria-hidden="true">
      <Icon strokeWidth={1.25} />
      {size === 'card' && <span>{product.brand}</span>}
    </div>
  );
}

function ProductCard({ product, onAdd, context }: { product: Product; onAdd: () => void; context?: string }) {
  const tid = context ? `${context}-${product.id}` : product.id;
  return (
    <article className="cx-card" data-testid={`card-product-${tid}`}>
      <div className="cx-card-media">
        <ProductVisual product={product} />
        {product.badge && <span className="cx-badge">{product.badge}</span>}
      </div>
      <div className="cx-card-body">
        <span className="cx-card-brand">{product.brand}</span>
        <h3 title={product.name}>{product.name}</h3>
        <ul className="cx-card-specs">
          {product.specs.slice(0, 2).map((spec) => <li key={spec}>{spec}</li>)}
        </ul>
        <div className="cx-card-price">
          <span className="cx-price">{formatPrice(product.price)}</span>
          <a className="cx-ref" href={product.priceSource.url} target="_blank" rel="noreferrer" title={`Reference price from ${product.priceSource.label}`} data-testid={`link-price-source-${tid}`}>
            Ref. price · {product.priceSource.asOf} <ExternalLink size={10} />
          </a>
        </div>
        <button type="button" className="cx-add" onClick={onAdd} aria-label={`Add ${product.name} to cart`} data-testid={`button-add-${tid}`}><ShoppingCart size={15} /> Add to cart</button>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return <div className="cx-grid" aria-label="Loading products">{[0, 1, 2, 3].map((item) => <div key={item} className="cx-card cx-card-skeleton"><div className="cx-card-media" /><div className="cx-card-body"><span /><span /><span /></div></div>)}</div>;
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
    <div className="checkout-page cx-checkout">
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
      <SiteFooter />
    </div>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default App;
