import { useSyncExternalStore, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';

export const SPRING = {
  control: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 },
  layout: { type: 'spring', stiffness: 420, damping: 36, mass: 0.85 },
  panel: { type: 'spring', stiffness: 400, damping: 38, mass: 0.9 },
} satisfies Record<string, Transition>;

export const FADE = { duration: 0.12, ease: 'easeOut' } satisfies Transition;
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
  whileTap,
  transition,
  type = 'button',
  ...props
}: HTMLMotionProps<'button'>) {
  const preferences = useMotionPreferences();
  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled}
      whileTap={disabled || preferences.reduced ? undefined : (whileTap ?? { scale: 0.985 })}
      transition={preferences.reduced ? INSTANT : (transition ?? SPRING.control)}
    />
  );
}

type CollapseProps = {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
  innerClassName?: string;
};

function CollapseContent({ children, id, className, innerClassName }: Omit<CollapseProps, 'open'>) {
  const present = useIsPresent();
  const { reduced, transition } = useMotionPreferences();
  return (
    <motion.div
      id={id}
      className={className}
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ height: transition('layout'), opacity: transition('fade') }}
      style={{ overflow: 'clip' }}
    >
      <div className={innerClassName} style={{ display: 'flow-root' }}>
        {children}
      </div>
    </motion.div>
  );
}

// For compact disclosures. Long reading surfaces should change without reflow animation.
export function Collapse({ open, ...props }: CollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && <CollapseContent key="content" {...props} />}
    </AnimatePresence>
  );
}
