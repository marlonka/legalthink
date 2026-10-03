import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, ChevronDown, Cpu, X } from 'lucide-react';
import type { Model } from './types';

export const DEFAULT_MODELS: Model[] = [
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    description: 'Für anspruchsvolle juristische Arbeit',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    default_effort: 'medium',
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Für zügige, fokussierte Prüfungen',
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
      initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
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
          setOpen(null);
          ref.current?.querySelector<HTMLButtonElement>(`[data-picker="${open}"]`)?.focus();
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
        <Cpu size={14} />
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
            <div className="popover-label">{open === 'model' ? 'Modell' : 'Denkaufwand'}</div>
            {open === 'model'
              ? models.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="picker-option"
                    aria-pressed={model === item.id}
                    onClick={() => {
                      onModel(item.id);
                      if (!item.efforts.includes(effort)) onEffort(item.default_effort);
                      setOpen(null);
                    }}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                    {model === item.id && <Check size={16} />}
                  </button>
                ))
              : current.efforts.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="picker-option"
                    aria-pressed={effort === value}
                    onClick={() => {
                      onEffort(value);
                      setOpen(null);
                    }}
                  >
                    <span>
                      {EFFORT_NAMES[value] ?? value}
                      {value === 'medium' && <small>Ausgewogen · Standard</small>}
                    </span>
                    {effort === value && <Check size={16} />}
                  </button>
                ))}
            {open === 'effort' && (
              <p className="popover-note">
                Mehr Denkaufwand kann die Prüfung vertiefen und Zeit sowie Kosten erhöhen.
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
