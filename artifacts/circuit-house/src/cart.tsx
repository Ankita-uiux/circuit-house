import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@workspace/api-client-react';

/** The shopping bag, saved in this browser. Shared by the store, product pages, chat and checkout. */

export type Fulfilment = 'pickup' | 'delivery' | 'shipping';
export type CartLine = { product: Product; quantity: number; colour?: string | null; fulfilment?: Fulfilment };

const CART_KEY = 'circuit-house-cart';

function readCart(): CartLine[] {
  try {
    const saved = localStorage.getItem(CART_KEY);
    const lines = saved ? JSON.parse(saved) as CartLine[] : [];
    return Array.isArray(lines) ? lines.filter((line) => line?.product?.id && line.quantity > 0) : [];
  } catch {
    return [];
  }
}

type CartContextValue = {
  cart: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  quantityOf: (id: string) => number;
  add: (product: Product, options?: { colour?: string | null; fulfilment?: Fulfilment }) => void;
  change: (id: string, amount: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [open, setOpen] = useState(false);
  const save = useCallback((update: (current: CartLine[]) => CartLine[]) => {
    setCart((current) => {
      const next = update(current);
      try { localStorage.setItem(CART_KEY, JSON.stringify(next)); } catch { /* memory only */ }
      return next;
    });
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    count: cart.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    open,
    setOpen,
    quantityOf: (id) => cart.find((line) => line.product.id === id)?.quantity ?? 0,
    add: (product, options = {}) => save((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => line.product.id === product.id
          ? { ...line, product, quantity: Math.min(10, line.quantity + 1), colour: options.colour ?? line.colour, fulfilment: options.fulfilment ?? line.fulfilment }
          : line);
      }
      return [...current, { product, quantity: 1, colour: options.colour ?? null, fulfilment: options.fulfilment ?? 'delivery' }];
    }),
    change: (id, amount) => save((current) => current.flatMap((line) => {
      if (line.product.id !== id) return [line];
      const quantity = Math.min(10, line.quantity + amount);
      return quantity > 0 ? [{ ...line, quantity }] : [];
    })),
    clear: () => save(() => []),
  }), [cart, open, save]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
