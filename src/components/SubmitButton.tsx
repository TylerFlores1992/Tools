"use client";

import { useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "./Button";
import { cx } from "./cx";
import { Spinner } from "./Spinner";

type Variant = "primary" | "quiet" | "ghost";

/**
 * A form's submit button that shows it heard you. Drop it into any form, server component or not.
 *
 * - While the form's action runs, the button you pressed shows a spinner and its `pending` words
 *   ("Saving…"), and every submit button in the form refuses a second press. It stays at full
 *   strength (aria-disabled, not `disabled`), so it reads as "working", not "unavailable", and
 *   keeps keyboard focus.
 * - `confirm` asks first ("Delete this stub?"); Cancel sends nothing.
 *
 * Why the click is tracked: `useFormStatus` reports the whole form as pending, so a form with two
 * buttons (Save / Delete) would otherwise spin both.
 */
export function SubmitButton({
  children,
  pending = "Working…",
  confirm,
  variant = "primary",
  className,
  onClick,
  disabled,
  ...rest
}: Omit<ComponentProps<"button">, "type"> & { pending?: ReactNode; confirm?: string; variant?: Variant }) {
  const { pending: busy } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  // Forget the press once the form is idle again (adjusting state while rendering, not in an
  // effect), so a later submit from a sibling button doesn't spin this one too.
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy) setPressed(false);
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (busy) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (confirm && !window.confirm(confirm)) {
      e.preventDefault();
      return;
    }
    setPressed(true);
  }

  const working = busy && pressed;
  return (
    <button
      type="submit"
      {...rest}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={working || undefined}
      onClick={handleClick}
      className={buttonClasses(variant, cx(busy && "cursor-progress", className))}
    >
      {working ? (
        <>
          <Spinner />
          {pending}
        </>
      ) : (
        children
      )}
    </button>
  );
}
