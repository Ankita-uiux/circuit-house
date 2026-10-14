import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ChevronRight, MessagesSquare, Package, ShieldCheck, Sparkles, Store, Tag, Truck } from 'lucide-react';
import { getListProductsQueryKey, useListProducts } from '@workspace/api-client-react';
import type { Product } from '@workspace/api-client-react';
import { useCart } from '@/cart';
import { useChat } from '@/chat/chat-context';
import { Header, SiteFooter } from '@/components/layout';
import { BadgePill, PriceBlock, ProductImage, QuantityStepper, StarRating, StoreProductCard, rememberedProduct, rememberProducts } from '@/components/store-ui';
import { apiUrl, formatPrice, imageSrc } from '@/shared';
import NotFound from './not-found';

const TABS = ['Overview', 'Specifications', 'Product Features', 'Reviews', 'Q&A'] as const;
type Tab = typeof TABS[number];

/** Suggested questions for the "Ask Circuit" box, by category. */
const QUESTIONS: Record<string, string[]> = {
  Laptops: ['Is it good for Figma?', 'How long does the battery last?', 'Can I upgrade the RAM later?', 'What is the warranty coverage?'],
  Phones: ['How good is the camera in low light?', 'How long does the battery last?', 'Will it get software updates for long?', 'What is the warranty coverage?'],
  Tablets: ['Is it good for taking notes?', 'Does it support a stylus?', 'How long does the battery last?', 'What is the warranty coverage?'],
  Audio: ['How good is the noise cancellation?', 'How long does the battery last?', 'Is the mic good for calls?', 'What is the warranty coverage?'],
  Wearables: ['Does it work with my phone?', 'How long does the battery last?', 'Is it accurate for workouts?', 'What is the warranty coverage?'],
  Cameras: ['Is it good for vlogging?', 'How long does the battery last?', 'What is in the box?', 'What is the warranty coverage?'],
};
const DEFAULT_QUESTIONS = ['What is it best for?', 'What is in the box?', 'What is the warranty coverage?'];

function useProduct(id: string) {
  const productsQuery = useListProducts({ query: { queryKey: getListProductsQueryKey() } });
  const chat = useChat();
  const fromCatalog = productsQuery.data?.find((product) => product.id === id);
  const [fetched, setFetched] = useState<Product | null | undefined>(undefined);
  const remembered = rememberedProduct(id);
  useEffect(() => {
    if (fromCatalog || remembered || !productsQuery.isSuccess) return;
    let cancelled = false;
    fetch(apiUrl(`/shop/products/${encodeURIComponent(id)}`), { headers: { 'x-chat-session': chat.sessionId } })
      .then((response) => (response.ok ? response.json() as Promise<Product> : null))
      .then((product) => { if (!cancelled) setFetched(product); })
      .catch(() => { if (!cancelled) setFetched(null); });
    return () => { cancelled = true; };
  }, [id, fromCatalog, remembered, productsQuery.isSuccess, chat.sessionId]);
  const product = fromCatalog ?? remembered ?? fetched ?? undefined;
  return { product, loading: !product && (productsQuery.isLoading || fetched === undefined), all: productsQuery.data ?? [] };
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? '');
  const { product, loading, all } = useProduct(id);
  const cart = useCart();
  const chat = useChat();
  const [image, setImage] = useState(0);
  const [tab, setTab] = useState<Tab>('Overview');
  const [colour, setColour] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setImage(0); setTab('Overview'); setColour(null); }, [id]);
  useEffect(() => { if (product) document.title = `${product.name} | Circuit House`; return () => { document.title = 'Circuit House | Electronics'; }; }, [product]);

  const similar = useMemo(() => {
    if (!product) return [];
    return all.filter((item) => item.category === product.category && item.id !== product.id)
      .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price)).slice(0, 8);
  }, [all, product]);
  useEffect(() => rememberProducts(similar), [similar]);

  if (loading) return <div className="cx-store"><Header /><main className="cx-main ch-pdp"><div className="ch-pdp-loading" aria-busy="true">Loading product…</div></main></div>;
  if (!product) return <NotFound />;

  const images = (product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean);
  const uniqueImages = [...new Set(images)];
  const quantity = cart.quantityOf(product.id);
  const colours = product.colours ?? [];
  const chosenColour = colour ?? colours[0]?.name ?? null;
  const questions = QUESTIONS[product.category] ?? DEFAULT_QUESTIONS;
  const productLabel = `${product.name} · ${formatPrice(product.price)}`;
  const askQuestion = (question: string) => {
    chat.setOpen(true);
    if (chat.nameStepDone) void chat.send(question, { quote: productLabel });
    else chat.ask(`${question} (about the ${product.name})`);
  };
  const askSomethingElse = () => { chat.setQuote(productLabel); chat.setOpen(true); };
  const showReviews = () => { setTab('Reviews'); tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="cx-store">
      <Header />
      <main className="cx-main ch-pdp" data-testid="page-product">
        <nav className="ch-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><ChevronRight size={13} />
          <Link href={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link><ChevronRight size={13} />
          <span aria-current="page">{product.name}</span>
        </nav>
        <header className="ch-pdp-title">
          <h1>{product.name}</h1>
          <div className="ch-pdp-sub">
            <span>Model {product.model ?? product.name}</span>
            <span>Brand <b>{product.brand}</b></span>
            <StarRating rating={product.rating} reviewCount={product.reviewCount} onReviews={showReviews} />
          </div>
        </header>

        <section className="ch-pdp-grid">
          <div className="ch-gallery">
            <div className="ch-thumbs" role="tablist" aria-label="Product images">
              {(uniqueImages.length > 1 ? uniqueImages : images.slice(0, 1)).map((src, index) => (
                <button type="button" key={src + index} role="tab" aria-selected={image === index} className={image === index ? 'is-active' : ''} onClick={() => setImage(index)} aria-label={`Image ${index + 1}`}>
                  <img src={imageSrc(src)} alt="" />
                </button>
              ))}
            </div>
            <div className="ch-gallery-main">
              {uniqueImages[image] ? <img src={imageSrc(uniqueImages[image])} alt={product.name} /> : <ProductImage product={product} sizes="hero" />}
            </div>
          </div>

          <aside className="ch-buybox" aria-label="Price and availability">
            <BadgePill badge={product.badge} />
            <PriceBlock product={product} size="large" />
            {product.offers && product.offers.length > 0 && (
              <ul className="ch-offers">{product.offers.map((offer) => <li key={offer}><Tag size={14} /> {offer}</li>)}</ul>
            )}
            {colours.length > 0 && (
              <fieldset className="ch-colours">
                <legend><b>Colour</b> {chosenColour}</legend>
                <div>{colours.map((item) => <button type="button" key={item.name} className={`ch-swatch${item.name === chosenColour ? ' is-selected' : ''}`} style={{ background: item.hex }} onClick={() => setColour(item.name)} aria-label={item.name} aria-pressed={item.name === chosenColour} title={item.name} />)}</div>
              </fieldset>
            )}
            <ul className="ch-stock ch-stock-large">
              <li className={product.stock?.status === 'low_stock' ? 'is-low' : 'is-good'}><Package size={16} /> {product.stock?.label ?? 'In stock'}</li>
              <li><Store size={16} /> Pickup at {product.pickup?.store ?? 'Circuit House'}: {product.pickup?.label?.toLowerCase() ?? 'ready within 2 hours'}</li>
              <li><Truck size={16} /> Free delivery: {product.delivery?.label ?? 'in 3–5 days'}</li>
              <li><ShieldCheck size={16} /> Brand warranty · 7-day returns</li>
            </ul>
            {quantity > 0
              ? <QuantityStepper quantity={quantity} label={product.name} onMinus={() => cart.change(product.id, -1)} onPlus={() => cart.change(product.id, 1)} onOpenBag={() => cart.setOpen(true)} />
              : <button type="button" className="ch-btn ch-btn-primary ch-btn-block ch-btn-large" onClick={() => cart.add(product, { colour: chosenColour, fulfilment: 'delivery' })} data-testid="button-pdp-add">Add to cart</button>}
          </aside>
        </section>

        <div className="ch-tabs" ref={tabsRef} role="tablist" aria-label="Product details">
          {TABS.map((item) => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)} data-testid={`tab-${item.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{item}</button>)}
        </div>
        <section className="ch-tab-panel" role="tabpanel" aria-label={tab}>
          {tab === 'Overview' && <><p>{product.description}</p><ul className="ch-highlights">{product.specs.slice(0, 4).map((spec) => <li key={spec}>{spec}</li>)}</ul></>}
          {tab === 'Specifications' && (
            <table className="ch-spec-table"><tbody>
              <tr><th>Brand</th><td>{product.brand}</td></tr>
              <tr><th>Model</th><td>{product.model ?? product.name}</td></tr>
              <tr><th>Category</th><td>{product.category}</td></tr>
              {colours.length > 0 && <tr><th>Colours</th><td>{colours.map((item) => item.name).join(', ')}</td></tr>}
              {product.specs.map((spec, index) => <tr key={spec}><th>{index === 0 ? 'Key specs' : ''}</th><td>{spec}</td></tr>)}
            </tbody></table>
          )}
          {tab === 'Product Features' && <div className="ch-feature-grid">{product.specs.map((spec) => <div key={spec} className="ch-feature"><Sparkles size={18} /><span>{spec}</span></div>)}</div>}
          {tab === 'Reviews' && (
            <div className="ch-reviews">
              {product.rating ? (
                <div className="ch-review-summary"><strong>{product.rating.toFixed(1)}</strong><div><StarRating rating={product.rating} reviewCount={product.reviewCount} /><p className="ch-muted">Average rating from buyers in India.</p></div></div>
              ) : <p className="ch-muted">No ratings yet for this product.</p>}
              <button type="button" className="ch-chip" onClick={() => askQuestion('What do reviewers like and dislike about it?')}><MessagesSquare size={14} /> Ask Circuit what reviewers say</button>
            </div>
          )}
          {tab === 'Q&A' && (
            <div className="ch-reviews">
              <p className="ch-muted">Have a question about this product? Circuit answers right away.</p>
              <div className="ch-chip-row">{questions.map((question) => <button type="button" key={question} className="ch-chip" onClick={() => askQuestion(question)}>{question}</button>)}</div>
            </div>
          )}
        </section>

        <section className="ch-ask-box" aria-labelledby="ask-box-title">
          <div className="ch-ask-head">
            <span className="ch-ask-icon" aria-hidden="true"><Sparkles size={16} /></span>
            <h2 id="ask-box-title">Ask Circuit</h2>
            <span className="ch-muted">Circuit is an AI virtual assistant · <button type="button" className="ch-link" onClick={() => chat.setOpen(true)}>More information</button></span>
          </div>
          <div className="ch-chip-row">
            {questions.map((question) => <button type="button" key={question} className="ch-chip" onClick={() => askQuestion(question)} data-testid="chip-ask-question">{question}</button>)}
            <button type="button" className="ch-chip ch-chip-accent" onClick={askSomethingElse} data-testid="chip-ask-else"><Sparkles size={14} /> Ask Something Else</button>
          </div>
        </section>

        {similar.length > 0 && (
          <section className="cx-row" aria-labelledby="similar-title">
            <div className="cx-row-head"><div><h2 id="similar-title">Here are some similar items…</h2></div></div>
            <div className="cx-row-track">{similar.map((item) => <StoreProductCard key={item.id} product={item} onAdd={() => cart.add(item)} context="similar" />)}</div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
