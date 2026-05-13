"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  photoId: string;
  previewUrl: string;
  priceCents: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (photoId: string) => void;
  clear: () => void;
  isInCart: (photoId: string) => boolean;
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  subtotalCents: number;
};

const Ctx = createContext<CartCtx | null>(null);

function storageKey(eventId: string) {
  return `cuervito.cart.${eventId}`;
}

export function CartProvider({
  children,
  eventId,
}: {
  children: React.ReactNode;
  eventId: string;
  pricePerPhoto: number;
  currency: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(eventId));
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [eventId]);

  // Persist on changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(eventId), JSON.stringify(items));
    } catch {
      // quota / private mode — silently ignore
    }
  }, [eventId, items, hydrated]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => (prev.some((i) => i.photoId === item.photoId) ? prev : [...prev, item]));
  }, []);

  const remove = useCallback((photoId: string) => {
    setItems((prev) => prev.filter((i) => i.photoId !== photoId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const isInCart = useCallback(
    (photoId: string) => items.some((i) => i.photoId === photoId),
    [items],
  );

  const subtotalCents = useMemo(
    () => items.reduce((a, b) => a + b.priceCents, 0),
    [items],
  );

  const value: CartCtx = {
    items,
    add,
    remove,
    clear,
    isInCart,
    open,
    openCart: () => setOpen(true),
    closeCart: () => setOpen(false),
    subtotalCents,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}
