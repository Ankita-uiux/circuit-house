import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchCatalog } from '../../../lib/catalog-search';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getListProductsQueryKey, useListProducts } from '@workspace/api-client-react';
import type { Product } from '@workspace/api-client-react';
import { CATEGORY_ICONS, formatPrice } from './shared';
import { CartProvider, useCart } from './cart';
import { ChatProvider, useChat } from './chat/chat-context';
import { AssistantLauncher, AssistantPanel } from './chat/AssistantPanel';
import { ErrorBoundary } from '@/components/error-boundary';
import { CartDrawer } from '@/components/cart-drawer';
import { CATEGORY_ORDER, Header, SiteFooter } from '@/components/layout';
import { StoreProductCard } from '@/components/store-ui';
import { useToast } from '@/hooks/use-toast';
import { ChatArt, FestiveArt, LaptopArt, PhonesArt } from './banners';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminPage from '@/pages/admin';
import Checkout from '@/pages/checkout';
import NotFound from '@/pages/not-found';
import ProductPage from '@/pages/product';

const queryClient = new QueryClient();


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <ChatProviderWithCart>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <RoutedErrorBoundary>
                <Switch>
                  <Route path="/"><Home /></Route>
                  <Route path="/product/:id"><ProductPage /></Route>
                  <Route path="/checkout"><Checkout /></Route>
                  <Route path="/admin"><AdminPage /></Route>
                  <Route component={NotFound} />
                </Switch>
              </RoutedErrorBoundary>
              <StoreChat />
            </WouterRouter>
          </ChatProviderWithCart>
        </CartProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ChatProviderWithCart({ children }: { children: ReactNode }) {
  const { cart, add } = useCart();
  const { toast } = useToast();
  // The assistant can add a product after the shopper asks it to.
  const onCartAdd = (product: Product) => { add(product); toast({ title: 'Added to cart', description: product.name }); };
  return <ChatProvider cart={cart} onCartAdd={onCartAdd}>{children}</ChatProvider>;
}

/** The chat and bag live outside the routes, so they stay open (same conversation) when the page changes. */
function StoreChat() {
  const [location] = useLocation();
  if (location.startsWith('/admin')) return null;
  return <><AssistantLauncher /><AssistantPanel /><CartDrawer /></>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
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
        {products.map((product) => <StoreProductCard key={product.id} product={product} onAdd={() => onAdd(product)} context={id} />)}
      </div>
    </section>
  );
}

function Home() {
  const productsQuery = useListProducts({ query: { queryKey: getListProductsQueryKey() } });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const { toast } = useToast();
  const cart = useCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('category');
    return fromUrl && (CATEGORY_ORDER as readonly string[]).includes(fromUrl) ? fromUrl : 'Everything';
  });
  const [sort, setSort] = useState('recommended');
  const chat = useChat();
  const catalogRef = useRef<HTMLElement>(null);

  const goToCatalog = () => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToRow = (id: string) => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const showCategory = (value: string) => { setCategory(value); setSearch(''); goToCatalog(); };
  // Arriving from a breadcrumb or footer link with ?category=… opens the catalog at that category.
  useEffect(() => {
    if (productsQuery.isSuccess && new URLSearchParams(window.location.search).get('category')) goToCatalog();
    // once, when products have loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsQuery.isSuccess]);
  const add = (product: Product) => {
    cart.add(product);
    toast({ title: 'Added to cart', description: product.name });
  };

  const categories = useMemo(() => ['Everything', ...CATEGORY_ORDER.filter((item) => products.some((product) => product.category === item))], [products]);
  const visibleProducts = useMemo(() => {
    let list = searchCatalog(products, search).filter((product) => category === 'Everything' || product.category === category);
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
      cta: 'Ask Circuit', action: () => chat.setOpen(true),
      art: <ChatArt productName="MacBook Neo" price={fromText(neoPrice) || '₹69,900'} />,
    },
  ];

  const heading = search.trim() ? `Results for “${search.trim()}”` : category === 'Everything' ? 'All products' : category;
  const askAboutSearch = () => chat.ask(search);

  return (
    <div className="cx-store">
      <Header search={search} onSearch={setSearch} onSubmitSearch={goToCatalog} />
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
            <ProductRow id="cameras" title="Cameras for creators" subtitle="Osmo, Insta360 and Sony, with exact kit variants." products={products.filter(product => product.category === 'Cameras')} onAdd={add} onViewAll={() => showCategory('Cameras')} />
          </>
        )}

        <section className="cx-catalog" id="catalog" ref={catalogRef} aria-labelledby="catalog-title">
          <div className="cx-catalog-head">
            <div>
              <h2 id="catalog-title">{heading}</h2>
              {productsQuery.isSuccess && <p>{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}</p>}
              {search.trim() && <button type="button" className="cx-chip" onClick={askAboutSearch}>Ask Circuit about this</button>}
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
            <div className="cx-empty"><strong>Can’t see it here?</strong><p>Ask Circuit. It can find the exact model for you, or try a different model or budget.</p><button type="button" className="cx-chip active" onClick={askAboutSearch}>Ask Circuit to find it</button><button type="button" className="cx-chip" onClick={() => { setSearch(''); setCategory('Everything'); }} data-testid="button-reset-filters">Clear filters</button></div>
          ) : (
            <div className="cx-grid">
              {visibleProducts.map((product) => <StoreProductCard key={product.id} product={product} onAdd={() => add(product)} />)}
            </div>
          )}
        </section>
      </main>
      <SiteFooter onCategory={showCategory} />
    </div>
  );
}

function ProductSkeleton() {
  return <div className="cx-grid" aria-label="Loading products">{[0, 1, 2, 3].map((item) => <div key={item} className="cx-card cx-card-skeleton"><div className="cx-card-media" /><div className="cx-card-body"><span /><span /><span /></div></div>)}</div>;
}

export default App;
