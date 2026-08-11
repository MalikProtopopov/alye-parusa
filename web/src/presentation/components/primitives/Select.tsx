"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/presentation/lib/cn";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  /** Primary line — truncated with ellipsis in the trigger. */
  label: string;
  /** Secondary line (area, price…) — wraps in the list. */
  hint?: string;
  disabled?: boolean;
}

/** Typeahead window: keystrokes closer than this compose one query. */
const TYPEAHEAD_MS = 700;
/** Below this much room the list flips above the trigger. */
const LIST_SPACE_PX = 280;

/**
 * Accessible select-only combobox (APG pattern): focus never leaves the
 * trigger, the listbox is driven by `aria-activedescendant`. Replaces the
 * native `<select>` so the states — hover, selected, focus, disabled — are
 * ours and the arrow never touches the field edge.
 */
export function Select({
  value,
  options,
  onChange,
  labelId,
  ariaLabel,
  placeholder = "Выберите вариант",
  disabled = false,
  className,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Id of the visible label element — wired via aria-labelledby. */
  labelId?: string;
  /** Fallback name when there is no visible label. */
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const triggerId = `${uid}-trigger`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  /** First selectable option walking from `start` in direction `step`. */
  const seek = useCallback(
    (start: number, step: number): number => {
      for (let i = start; i >= 0 && i < options.length; i += step) {
        if (!options[i].disabled) return i;
      }
      return -1;
    },
    [options],
  );

  const openList = useCallback(
    (index?: number) => {
      if (disabled || options.length === 0) return;
      const from = index ?? (selectedIndex >= 0 ? selectedIndex : 0);
      const next = options[from]?.disabled ? seek(from, 1) : from;
      setActiveIndex(next >= 0 ? next : Math.max(0, seek(0, 1)));
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const below = window.innerHeight - rect.bottom;
        setDropUp(below < LIST_SPACE_PX && rect.top > below);
      }
      setOpen(true);
    },
    [disabled, options, seek, selectedIndex],
  );

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      close();
    },
    [close, onChange, options],
  );

  // Click outside closes without stealing focus back.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the virtually-focused option visible inside the scrolling list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        openList(event.key === "End" ? seek(options.length - 1, -1) : undefined);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = seek(activeIndex + 1, 1);
        if (next >= 0) setActiveIndex(next);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = seek(activeIndex - 1, -1);
        if (prev >= 0) setActiveIndex(prev);
        return;
      }
      case "Home": {
        event.preventDefault();
        const first = seek(0, 1);
        if (first >= 0) setActiveIndex(first);
        return;
      }
      case "End": {
        event.preventDefault();
        const last = seek(options.length - 1, -1);
        if (last >= 0) setActiveIndex(last);
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        commit(activeIndex);
        return;
      }
      case "Escape": {
        event.preventDefault();
        close();
        return;
      }
      case "Tab": {
        // Let focus leave naturally — just put the list away.
        setOpen(false);
        return;
      }
      default:
        break;
    }

    // Typeahead: «ст» jumps to «Студия».
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const query =
        (now - typeahead.current.at < TYPEAHEAD_MS ? typeahead.current.query : "") +
        event.key.toLowerCase();
      typeahead.current = { query, at: now };
      const match = options.findIndex(
        (option) => !option.disabled && option.label.toLowerCase().startsWith(query),
      );
      if (match >= 0) {
        event.preventDefault();
        setActiveIndex(match);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        className={cn(styles.trigger, open && styles.triggerOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[activeIndex] ? optionId(activeIndex) : undefined}
        {...(labelId
          ? { "aria-labelledby": `${labelId} ${triggerId}` }
          : ariaLabel
            ? { "aria-label": ariaLabel }
            : {})}
        disabled={disabled || options.length === 0}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={styles.value}>
          <span className={styles.valueLabel}>{selected ? selected.label : placeholder}</span>
          {selected?.hint ? <span className={styles.valueHint}>{selected.hint}</span> : null}
        </span>
        <span className={styles.arrow} aria-hidden="true">
          <svg viewBox="0 0 16 16" className={styles.arrowIcon}>
            <path d="M3 6l5 5 5-5" />
          </svg>
        </span>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={cn(styles.list, dropUp && styles.listUp)}
          {...(labelId ? { "aria-labelledby": labelId } : {})}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                {...(option.disabled ? { "aria-disabled": true } : {})}
                data-active={index === activeIndex}
                className={cn(
                  styles.option,
                  index === activeIndex && styles.optionActive,
                  isSelected && styles.optionSelected,
                  option.disabled && styles.optionDisabled,
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  if (!option.disabled) setActiveIndex(index);
                }}
                onClick={() => commit(index)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint ? (
                    <span className={styles.optionHint}>{option.hint}</span>
                  ) : null}
                </span>
                <span className={styles.check} aria-hidden="true">
                  <svg viewBox="0 0 16 16" className={styles.checkIcon}>
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
