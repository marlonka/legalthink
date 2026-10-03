import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, ChevronDown, X } from 'lucide-react';
import type { Model } from './types';

export const DEFAULT_MODELS: Model[] = [
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    description: '',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    default_effort: 'medium',
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: '',
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    default_effort: 'medium',
  },
];
export const EFFORT_NAMES: Record<string, string> = {
  none: 'Ohne',
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  xhigh: 'Sehr hoch',
  max: 'Maximum',
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 5v22h19M14 5v15h12" />
      </svg>
      {!compact && (
        <span>
          LegalThink<span className="brand-suffix">GPT</span>
        </span>
      )}
    </span>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="page-transition"
      initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>('[autofocus], input, textarea, button');
    first?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ) ?? [],
      );
      const firstElement = focusable[0],
        lastElement = focusable.at(-1);
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.97, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 36 }}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Dialog schließen">
            <X size={19} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function ModelPicker({
  models,
  model,
  effort,
  onModel,
  onEffort,
  disabled = false,
}: {
  models: Model[];
  model: string;
  effort: string;
  onModel: (value: string) => void;
  onEffort: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<'model' | 'effort' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((item) => item.id === model) ?? models[0];
  const menuId = useId();
  const effortIndex = Math.max(0, current.efforts.indexOf(effort));
  function closePicker() {
    setOpen(null);
    ref.current?.querySelector<HTMLButtonElement>(`[data-picker="${open}"]`)?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const listener = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, [open]);
  return (
    <div
      className="model-picker"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closePicker();
        }
      }}
    >
      <button
        type="button"
        className="picker-button"
        data-picker="model"
        aria-expanded={open === 'model'}
        aria-controls={`${menuId}-model`}
        onClick={() => setOpen(open === 'model' ? null : 'model')}
        disabled={disabled}
      >
        <span>{current.name}</span>
        <ChevronDown size={12} />
      </button>
      <span className="picker-divider" />
      <button
        type="button"
        className="picker-button effort-picker"
        data-picker="effort"
        aria-label={`Denkaufwand: ${EFFORT_NAMES[effort] ?? effort}`}
        aria-expanded={open === 'effort'}
        aria-controls={`${menuId}-effort`}
        onClick={() => setOpen(open === 'effort' ? null : 'effort')}
        disabled={disabled}
      >
        <span>{EFFORT_NAMES[effort] ?? effort}</span>
        <ChevronDown size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={`${menuId}-${open}`}
            className={`picker-popover ${open === 'effort' ? 'effort-popover' : ''}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.12 }}
          >
            {open === 'model' ? (
              models.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="picker-option"
                  disabled={disabled}
                  aria-pressed={model === item.id}
                  onClick={() => {
                    onModel(item.id);
                    if (!item.efforts.includes(effort)) onEffort(item.default_effort);
                    closePicker();
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                  </span>
                  {model === item.id && <Check size={16} />}
                </button>
              ))
            ) : (
              <div className="effort-control">
                <output className="effort-current" htmlFor={`${menuId}-range`}>
                  {EFFORT_NAMES[effort] ?? effort}
                </output>
                <div className="effort-track">
                  <input
                    id={`${menuId}-range`}
                    className="effort-range"
                    type="range"
                    disabled={disabled}
                    min={0}
                    max={current.efforts.length - 1}
                    step={1}
                    value={effortIndex}
                    aria-label="Denkaufwand"
                    aria-valuetext={EFFORT_NAMES[effort] ?? effort}
                    aria-describedby={`${menuId}-cost`}
                    onChange={(event) => onEffort(current.efforts[Number(event.target.value)])}
                    style={
                      {
                        '--effort-progress': `${(effortIndex / Math.max(1, current.efforts.length - 1)) * 100}%`,
                      } as CSSProperties
                    }
                  />
                  <div className="effort-ticks" aria-hidden="true">
                    {current.efforts.map((value, index) => (
                      <span
                        key={value}
                        style={{
                          left: `${(index / Math.max(1, current.efforts.length - 1)) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {open === 'effort' && (
              <p className="popover-note" id={`${menuId}-cost`}>
                Höherer Denkaufwand kann länger dauern und mehr kosten.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(url)) return <span>{children}</span>;
  return (
    <a className="external-link" href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="error-message">
      {children}
    </p>
  );
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}
