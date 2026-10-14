import { useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Award, ChevronDown, Minus, Package, Plus, ShoppingCart, Star, Store, Truck } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { ShoppingBag } from 'lucide-react';
import { CATEGORY_ICONS, formatPrice, imageSrc } from '@/shared';

/**
 * Building blocks shared by store cards, chat cards, the options sheet and the
 * product page, so every screen uses the same price, rating, stock and button styles.
 */

const known = new Map<string, Product>();
/** Keeps products seen anywhere (including ones found in chat) so their product page can open instantly. */
export function rememberProducts(products: Product[] | undefined) {
  for (const product of products ?? []) known.set(product.id, product);
}
export function rememberedProduct(id: string) {
  return known.get(id);
}

export function productHref(product: Product) {
  return `/product/${encodeURIComponent(product.id)}`;
}

export function useOpenProduct() {
  const [, navigate] = useLocation();
  return (product: Product) => {
    rememberProducts([product]);
    navigate(productHref(product));
    window.scrollTo({ top: 0 });
  };
}

/** Product photo with a hover swap to the second image (or a close-up when there is only one). */
export function ProductImage({ product, sizes = 'card' }: { product: Product; sizes?: 'card' | 'thumb' | 'hero' }) {
  const [failed, setFailed] = useState(false);
  const images = (product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean);
  if (!images.length || failed) {
    const Icon = CATEGORY_ICONS[product.category] ?? ShoppingBag;
    return (
      <div className={`brand-tile brand-tile-${product.category.toLowerCase()} ${sizes === 'thumb' ? 'brand-tile-thumb' : ''}`} aria-hidden="true">
        <Icon strokeWidth={1.25} />
        {sizes !== 'thumb' && <span>{product.brand}</span>}
      </div>
    );
  }
  const second = images[1] && images[1] !== images[0] ? images[1] : null;
  return (
    <span className={`ch-img${second ? ' has-second' : ' zoom-on-hover'}`}>
      <img src={imageSrc(images[0])} alt={product.name} loading="lazy" decoding="async" onError={() => setFailed(true)} data-testid={`img-product-${product.id}`} />
      {second && sizes !== 'thumb' && <img className="ch-img-second" src={imageSrc(second)} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
    </span>
  );
}

export function BadgePill({ badge }: { badge?: string | null }) {
  if (!badge) return null;
  const Icon = /rated/i.test(badge) ? Star : Award;
  return <span className="ch-badge"><Icon size={12} strokeWidth={2.4} /> {badge}</span>;
}

export function StarRating({ rating, reviewCount, onReviews, compact = false }: { rating?: number | null; reviewCount?: number | null; onReviews?: () => void; compact?: boolean }) {
  if (rating === null || rating === undefined) return compact ? null : <span className="ch-rating ch-rating-none">No ratings yet</span>;
  const full = Math.round(rating * 2) / 2;
  const count = reviewCount ? `${reviewCount.toLocaleString('en-IN')} ${reviewCount === 1 ? 'review' : 'reviews'}` : null;
  return (
    <span className="ch-rating" aria-label={`Rated ${rating} out of 5${count ? `, ${count}` : ''}`}>
      <span className="ch-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={n <= full ? 'on' : n - 0.5 === full ? 'half' : ''} />)}
      </span>
      <span className="ch-rating-value">{rating.toFixed(1)}</span>
      {count && (onReviews
        ? <button type="button" className="ch-review-link" onClick={onReviews}>{count}</button>
        : <span className="ch-review-link">{count}</span>)}
    </span>
  );
}

export function PriceBlock({ product, size = 'card' }: { product: Product; size?: 'card' | 'large' | 'sheet' }) {
  const mrp = product.mrp && product.mrp > product.price ? product.mrp : null;
  const save = mrp ? mrp - product.price : 0;
  return (
    <div className={`ch-price ch-price-${size}`}>
      <span className={`ch-price-now${mrp ? ' is-sale' : ''}`}>{formatPrice(product.price)}</span>
      {size === 'sheet' && mrp && <span className="ch-price-reg">MRP <s>{formatPrice(mrp)}</s></span>}
      {size !== 'sheet' && mrp && <span className="ch-price-reg">MRP <s>{formatPrice(mrp)}</s> <b>Sale</b></span>}
      {size !== 'card' && mrp && <span className="ch-price-save"><b>Sale</b> save {formatPrice(save)} ({Math.round((save / mrp) * 100)}% off)</span>}
      {product.overBudgetBy ? <span className="ch-over-budget">+{formatPrice(product.overBudgetBy)} over budget</span> : null}
    </div>
  );
}

export function StockBox({ product }: { product: Product }) {
  if (!product.stock) return null;
  return (
    <ul className="ch-stock" aria-label="Availability">
      <li className={product.stock.status === 'low_stock' ? 'is-low' : ''}><Package size={14} /> {product.stock.label}</li>
      {product.pickup && <li><Store size={14} /> Pickup: {product.pickup.label.toLowerCase()}</li>}
      {product.delivery && <li><Truck size={14} /> Delivery: {product.delivery.label.replace(/^Arrives/, 'arrives')}</li>}
    </ul>
  );
}

export function QuantityStepper({ quantity, onMinus, onPlus, onOpenBag, label }: { quantity: number; onMinus: () => void; onPlus: () => void; onOpenBag?: () => void; label: string }) {
  return (
    <div className="ch-stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={onMinus} aria-label={`Remove one ${label}`} data-testid="button-stepper-minus"><Minus size={17} /></button>
      <button type="button" className="ch-stepper-count" onClick={onOpenBag} aria-label="Open bag" data-testid="text-stepper-count">{quantity} in cart <ChevronDown size={15} /></button>
      <button type="button" onClick={onPlus} aria-label={`Add one more ${label}`} data-testid="button-stepper-plus"><Plus size={17} /></button>
    </div>
  );
}

/** Store grid / row card. Clicking the image or name opens the product page. */
export function StoreProductCard({ product, onAdd, context }: { product: Product; onAdd: () => void; context?: string }) {
  const tid = context ? `${context}-${product.id}` : product.id;
  const open = (event: MouseEvent) => { if (!event.metaKey && !event.ctrlKey) rememberProducts([product]); };
  return (
    <article className="cx-card ch-card" data-testid={`card-product-${tid}`}>
      <Link href={productHref(product)} className="cx-card-media ch-media" onClick={open} aria-label={product.name}>
        <ProductImage product={product} />
      </Link>
      <div className="cx-card-body">
        <BadgePill badge={product.badge} />
        <PriceBlock product={product} />
        <span className="ch-desc" title={product.specs.slice(0, 2).join(' · ')}>{product.specs.slice(0, 2).join(' · ')}</span>
        <Link href={productHref(product)} className="ch-name" onClick={open} title={product.name}>{product.name}</Link>
        <StarRating rating={product.rating} reviewCount={product.reviewCount} />
        <button type="button" className="ch-btn ch-btn-primary" onClick={onAdd} aria-label={`Add ${product.name} to cart`} data-testid={`button-add-${tid}`}><ShoppingCart size={15} /> Add to cart</button>
      </div>
    </article>
  );
}
