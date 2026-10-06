"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/cx";
import { HIT_AREA } from "./hit";
import {
  addDays, addMonths, daysInMonth, firstDayOfWeek, formatRange, isBefore, isWithin, longDate, monthLabel,
  nightsBetween, parseISO, shortDate, startOfMonth, toISO, todayISO, type ISODate,
} from "./date";

// Ported from campsite-finder src/components/ui/DatePicker.tsx (2026-10-06): a collapsed bar that
// opens a month grid. The range is two ISO dates, so a stay can cross months; when one end is in
// another month a strip says which. The grid is a real role="grid" with a roving tab stop: arrows
// move a day, Up/Down a week, Home/End the week's edges, PageUp/PageDown a month, Escape closes
// and hands focus back to the bar.
// Lab changes: reading sizes; stock `text-white` is `text-ch-white`; no partial opacity.
export interface DateRange {
  start: ISODate | null;
  end: ISODate | null;
}

const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const navButton = `${HIT_AREA} grid size-8 cursor-pointer place-items-center rounded-lg border border-ch-line bg-ch-paper text-ch-ink-2 hover:border-ch-green hover:text-ch-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green`;

export function DatePicker({
  value, onChange, label, placeholder = "Add dates", meta, minDate, defaultMonth, defaultOpen = false,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  /** Accessible name, e.g. "Trip dates" or "Window to watch". */
  label: string;
  placeholder?: string;
  /** Replaces the nights readout, e.g. "any 2-night stay in this window". */
  meta?: string;
  minDate?: ISODate;
  defaultMonth?: ISODate;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  const gridLabelId = `${id}-gridlabel`;
  const [open, setOpen] = useState(defaultOpen);
  const floor = minDate ?? todayISO();
  const [view, setView] = useState<ISODate>(() => startOfMonth(defaultMonth ?? value.start ?? floor));
  const [focusedDay, setFocusedDay] = useState<ISODate>(() => value.start ?? floor);
  const keyboardRef = useRef(false);
  const dayRefs = useRef(new Map<ISODate, HTMLButtonElement>());
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeToTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open || !keyboardRef.current) return;
    dayRefs.current.get(focusedDay)?.focus();
    keyboardRef.current = false;
  }, [focusedDay, open, view]);

  const monthStart = startOfMonth(view);
  const pad = firstDayOfWeek(monthStart);
  const total = daysInMonth(monthStart);
  const weeks = useMemo(() => {
    const base = parseISO(monthStart);
    const days = Array.from({ length: total }, (_, i) => toISO(new Date(base.getFullYear(), base.getMonth(), i + 1)));
    const cells: Array<ISODate | null> = [...Array<null>(pad).fill(null), ...days];
    while (cells.length % 7 !== 0) cells.push(null);
    const out: Array<Array<ISODate | null>> = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [monthStart, pad, total]);

  const { start, end } = value;
  const monthEnd = addDays(addMonths(monthStart, 1), -1);
  const carriesIn = Boolean(start && isBefore(start, monthStart));
  const carriesOut = Boolean(end && isBefore(monthEnd, end));
  const monthNameOf = (iso: ISODate) => monthLabel(iso).split(" ")[0];

  function select(day: ISODate) {
    if (day < floor) return;
    if (!start || end || day <= start) onChange({ start: day, end: null });
    else onChange({ start, end: day });
  }

  function moveFocus(next: ISODate) {
    if (next < floor) return;
    keyboardRef.current = true;
    setFocusedDay(next);
    if (next.slice(0, 7) !== monthStart.slice(0, 7)) setView(startOfMonth(next));
  }

  function onGridKeyDown(e: KeyboardEvent) {
    const k = e.key;
    const dow = parseISO(focusedDay).getDay();
    const moves: Record<string, ISODate> = {
      ArrowLeft: addDays(focusedDay, -1), ArrowRight: addDays(focusedDay, 1),
      ArrowUp: addDays(focusedDay, -7), ArrowDown: addDays(focusedDay, 7),
      Home: addDays(focusedDay, -dow), End: addDays(focusedDay, 6 - dow),
      PageUp: addMonths(focusedDay, -1), PageDown: addMonths(focusedDay, 1),
    };
    if (k === "Escape") { e.preventDefault(); closeToTrigger(); return; }
    if (!(k in moves)) return;
    e.preventDefault();
    moveFocus(moves[k]);
  }

  const rangeLabel = formatRange(start, end);
  const nights = start && end ? nightsBetween(start, end) : 0;
  const metaLine = meta ?? (nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "Choose your check-in and check-out");

  return (
    <div>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cx(
          "flex min-h-14 w-full cursor-pointer items-center gap-2.5 border bg-ch-card px-3.5 py-2.5 text-left transition-colors motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green",
          open ? "rounded-t-ch-input border-ch-green" : "rounded-ch-input border-ch-line hover:border-ch-muted",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="sr-only">{label}: </span>
          <span className={cx("block font-ch-display text-[16px] font-bold", rangeLabel ? "text-ch-ink" : "text-ch-muted")}>{rangeLabel ?? placeholder}</span>
          <span className="mt-0.5 block text-[13px] text-ch-muted">{metaLine}</span>
        </span>
        <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 text-ch-muted transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      {open && (
        <div id={panelId} className="rounded-b-ch-input border border-t-0 border-ch-green bg-ch-card p-3">
          {(carriesIn || carriesOut) && (
            <p aria-live="polite" className="mb-2.5 flex items-start gap-2 rounded-[9px] border border-ch-green-line bg-ch-green-soft px-2.5 py-2 text-[13px] leading-snug text-ch-green-deep">
              <span aria-hidden="true" className="mt-px shrink-0 text-[10px]">{carriesIn ? "◀" : "▶"}</span>
              <span>
                {carriesIn && start && (
                  <>Check-in <strong className="font-extrabold">{shortDate(start)}</strong> is in {monthNameOf(start)}{carriesOut ? ", " : " — pick your check-out below."}</>
                )}
                {carriesOut && end && (
                  <>{carriesIn ? "check-out " : "Check-out "}<strong className="font-extrabold">{shortDate(end)}</strong> is in {monthNameOf(end)}.</>
                )}
              </span>
            </p>
          )}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView(addMonths(monthStart, -1))} aria-label="Previous month" className={navButton}>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <div id={gridLabelId} aria-live="polite" className="font-ch-display text-[16px] font-bold text-ch-ink">{monthLabel(monthStart)}</div>
            <button type="button" onClick={() => setView(addMonths(monthStart, 1))} aria-label="Next month" className={navButton}>
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div role="grid" aria-labelledby={gridLabelId} onKeyDown={onGridKeyDown}>
            <div role="row" className="mb-1 grid grid-cols-7">
              {DOW_SHORT.map((d, i) => (
                <span key={i} role="columnheader" aria-label={DOW_FULL[i]} className="text-center text-[12px] font-bold text-ch-muted">{d}</span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div role="row" key={wi} className="grid grid-cols-7 gap-[3px]">
                {week.map((day, di) => {
                  if (!day) {
                    const tint = (wi === 0 && carriesIn && (!end || !isBefore(end, monthStart))) || (wi === weeks.length - 1 && carriesOut);
                    return <div key={`b-${di}`} role="gridcell" aria-hidden="true" className={cx("aspect-square rounded", tint && "bg-ch-green-soft")} />;
                  }
                  const disabled = day < floor;
                  const isStart = day === start;
                  const isEnd = day === end;
                  const isMid = Boolean(start && end && isWithin(day, start, end));
                  const selected = isStart || isEnd;
                  return (
                    <button
                      key={day}
                      ref={(el) => { if (el) dayRefs.current.set(day, el); else dayRefs.current.delete(day); }}
                      type="button"
                      role="gridcell"
                      aria-selected={selected || isMid}
                      aria-label={longDate(day)}
                      aria-disabled={disabled || undefined}
                      tabIndex={day === focusedDay ? 0 : -1}
                      onClick={() => { setFocusedDay(day); select(day); }}
                      className={cx(
                        "flex aspect-square max-h-11 w-full items-center justify-center justify-self-center font-ch-body text-[14px] font-semibold tabular-nums transition-colors motion-reduce:transition-none",
                        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ch-green",
                        isMid ? "rounded-[4px]" : "rounded-lg",
                        disabled && "cursor-not-allowed text-ch-faint",
                        !disabled && !selected && !isMid && "cursor-pointer text-ch-ink-2 hover:bg-ch-green-soft",
                        selected && "cursor-pointer bg-ch-green font-bold text-ch-white",
                        isMid && "cursor-pointer bg-ch-green-soft font-bold text-ch-green-deep",
                      )}
                    >
                      {parseISO(day).getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <button type="button" onClick={() => onChange({ start: null, end: null })} className="min-h-11 cursor-pointer px-1 text-[14px] font-semibold text-ch-muted hover:text-ch-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
              Clear
            </button>
            <button type="button" onClick={closeToTrigger} className="min-h-11 cursor-pointer rounded-lg bg-ch-green px-5 font-ch-body text-[14px] font-bold text-ch-white hover:bg-ch-green-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ch-green">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
