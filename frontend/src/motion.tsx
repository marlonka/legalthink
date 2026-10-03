import { useSyncExternalStore, type ReactNode } from 'react';
import { motion, type HTMLMotionProps, type Transition } from 'motion/react';

const SPRING = {
  control: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 },
  panel: { type: 'spring', stiffness: 400, damping: 38, mass: 0.9 },
} satisfies Record<string, Transition>;

const TIMING = {
  fade: { duration: 0.12, ease: 'easeOut' },
  enter: { duration: 0.16, ease: [0.2, 0, 0, 1] },
  exit: { duration: 0.1, ease: [0.4, 0, 1, 1] },
  page: { duration: 0.18, ease: [0.2, 0, 0, 1] },
  press: { duration: 0.06, ease: 'easeOut' },
  release: { duration: 0.14, ease: 'easeOut' },
} satisfies Record<string, Transition>;
const INSTANT = { duration: 0 } satisfies Transition;
type Preset = keyof typeof SPRING | keyof typeof TIMING;

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
    transition: (preset: Preset = 'control'): Transition => {
      if (reduced) return INSTANT;
      return preset in TIMING
        ? TIMING[preset as keyof typeof TIMING]
        : SPRING[preset as keyof typeof SPRING];
    },
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
      whileTap={
        disabled ? undefined : { opacity: 0.88, transition: preferences.transition('press') }
      }
      transition={preferences.reduced ? INSTANT : (transition ?? TIMING.release)}
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
      transition={transition('enter')}
    >
      <div style={{ display: 'flow-root' }}>{children}</div>
    </motion.div>
  );
}
