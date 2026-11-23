"use client";
import { useEffect, useState } from "react";

export function Toasts() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, text: (e as CustomEvent<string>).detail }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener("sp:toast", on);
    return () => window.removeEventListener("sp:toast", on);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast"><i>✓</i>{t.text}</div>
      ))}
    </div>
  );
}
