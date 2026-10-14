import { useState } from 'react';
import { Camera, Gamepad2, Headphones, Laptop, Mouse, ShoppingBag, Smartphone, Tablet, Tv, Watch, type LucideIcon } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';

export type CartLine = { product: Product; quantity: number };

/** API path under the app's base URL, e.g. apiUrl('/shop/products'). */
export function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Cameras: Camera, Gaming: Gamepad2, TVs: Tv,
  Phones: Smartphone, Laptops: Laptop, Tablets: Tablet, Audio: Headphones, Wearables: Watch, Accessories: Mouse,
};

export function imageSrc(image: string) {
  return image.startsWith('/') ? `${import.meta.env.BASE_URL}${image.slice(1)}` : image;
}

/** Product photo when one is set; otherwise a tile with the brand and a category icon. */
export function ProductVisual({ product, size = 'card' }: { product: Product; size?: 'card' | 'thumb' }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (product.image && product.image !== failedImage) {
    return <img src={imageSrc(product.image)} className={product.origin === 'market' ? 'market-packshot' : undefined} alt={product.name} width={800} height={800} loading="lazy" decoding="async" onError={() => setFailedImage(product.image)} data-testid={`img-product-${product.id}`} />;
  }
  const Icon = CATEGORY_ICONS[product.category] ?? ShoppingBag;
  return (
    <div className={`brand-tile brand-tile-${product.category.toLowerCase()} ${size === 'thumb' ? 'brand-tile-thumb' : ''}`} aria-hidden="true">
      <Icon strokeWidth={1.25} />
      {size === 'card' && <span>{product.brand}</span>}
    </div>
  );
}
