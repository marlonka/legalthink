import { useSyncExternalStore, type ReactNode } from 'react';
import { motion, type HTMLMotionProps, type Transition } from 'motion/react';

const SPRING = {
  control: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 },
  panel: { type: 'spring', stiffness: 400, damping: 38, mass: 0.9 },
} satisfies Record<string, Transition>;

const FADE = { duration: 0.12, ease: 'easeOut' } satisfies Transition;
const INSTANT = { duration: 0 } satisfies Transition;
type Preset = keyof typeof SPRING | 'fade';

let reducedMotionQuery: MediaQueryList | undefined;
function motionQuery() {
  if (typeof window === 'undefined') return undefined;
  return (reducedMotionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)'));
}

function subscribeToMotionPreference(onChange: () => void) {
  const query = motionQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

// Subscribe directly so an OS preference change also affects an open session.
export function useMotionPreferences() {
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    () => motionQuery()?.matches ?? false,
    () => false,
  );
  return {
    reduced,
    transition: (preset: Preset = 'control'): Transition =>
      reduced ? INSTANT : preset === 'fade' ? FADE : SPRING[preset],
  };
}

export function MotionButton({
  disabled,
  transition,
  type = 'button',
  ...props
}: Omit<HTMLMotionProps<'button'>, 'whileTap' | 'whileHover'>) {
  const preferences = useMotionPreferences();
  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled}
      whileTap={disabled || preferences.reduced ? undefined : { opacity: 0.82 }}
      transition={preferences.reduced ? INSTANT : (transition ?? FADE)}
    />
  );
}

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
};

// Apply the requested disclosure once. Height springs move every following control.
export function Collapse({ open, children, id, className }: CollapseProps) {
  const { reduced, transition } = useMotionPreferences();
  if (!open) return null;
  return (
    <motion.div
      id={id}
      className={className}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition('fade')}
    >
      <div style={{ display: 'flow-root' }}>{children}</div>
    </motion.div>
  );
}
