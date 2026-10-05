'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Restrained entrance animation.
 *
 * Data surfaces should settle quickly and stay still — motion here is a short
 * fade and lift on first view, nothing that delays reading a figure. Honours
 * prefers-reduced-motion by rendering statically.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers a list of children without each caller repeating delay maths. */
export function RevealGroup({
  children,
  className,
  step = 0.05,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={Math.min(i * step, 0.4)}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
