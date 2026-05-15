import { useEffect, useRef, useState } from 'react';

/**
 * Wrapper que anima o conteúdo quando ele entra na viewport (scroll reveal).
 *
 * Usa IntersectionObserver — uma única observação por elemento, libera o
 * observer assim que dispara. Sem listener global de scroll (mais eficiente
 * e não acumula RAFs).
 *
 * Props:
 *   - delay: ms antes de aplicar a classe (escalona slides em sequência)
 *   - threshold: 0..1 — fração visível pra disparar (default 0.15)
 *   - className: classes extras (passa pro div interno)
 *   - as: tag HTML (default 'div') — útil pra section/article/etc
 *   - once: bool (default true) — se false, anima toda vez que entrar
 *
 * O CSS está em src/index.css na classe `.reveal` + `.reveal-in`.
 */
export default function Reveal({
  children,
  delay = 0,
  threshold = 0.15,
  className = '',
  as: Tag = 'div',
  once = true,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respeita preferência do usuário por menos movimento
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delay > 0) {
              const t = setTimeout(() => setVisible(true), delay);
              if (once) observer.unobserve(node);
              return () => clearTimeout(t);
            }
            setVisible(true);
            if (once) observer.unobserve(node);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, threshold, once]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-in' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
