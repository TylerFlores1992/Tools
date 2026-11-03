"use client";

import { useActionState } from "react";
import { State } from "@/components/State";
import { SubmitButton } from "@/components/SubmitButton";
import { saveAccount, type FormState } from "@/app/private/money/actions";

const FIELD = "field min-h-11 w-full rounded-input border border-control bg-surface px-3 text-body text-ink";

export type AccountFormProps = {
  id: string;
  bankName: string;
  placeholder: string;
  displayName: string | null;
  owner: string | null;
  hidden: boolean;
  owners: ReadonlyArray<readonly [string, string]>;
};

/**
 * One account's name, owner and hidden switch, with "Saving…" while it saves and "Saved." after.
 * The form inside is keyed on the saved values: React resets a form after its action runs, and a
 * reset <select> fell back to "Not set" instead of the value just saved (docs/MONEY.md). The key
 * remounts the form with the new defaults; the message lives outside it, so it survives.
 */
export function AccountForm({ id, bankName, placeholder, displayName, owner, hidden, owners }: AccountFormProps) {
  const [state, action] = useActionState<FormState, FormData>(saveAccount, { attempt: 0 });
  return (
    <div className="border-t border-line p-4">
      <form key={`${owner ?? ""}|${displayName ?? ""}|${hidden}`} action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-end">
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-muted sm:col-span-2">{bankName}</p>
        <label className="grid gap-1.5">
          <span className="text-small text-ink-2">Name to show</span>
          <input name="displayName" defaultValue={displayName ?? ""} placeholder={placeholder} maxLength={60} className={`${FIELD} placeholder:text-muted`} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-small text-ink-2">Whose</span>
          <select name="owner" defaultValue={owner ?? ""} className={FIELD}>
            <option value="">Not set</option>
            {owners.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-small text-ink-2">
          <input type="checkbox" name="hidden" defaultChecked={hidden} className="size-5 accent-ink" />
          Hide this account
        </label>
        <SubmitButton variant="quiet" pending="Saving…" className="sm:justify-self-end">Save</SubmitButton>
      </form>
      {/* Outside the keyed form, so the live region isn't remounted and the message is announced. */}
      <p aria-live="polite" className="mt-2 text-small">
        {state.error ? <State kind="wrong">{state.error}</State> : state.done ? <State kind="ok">{state.done}</State> : null}
      </p>
    </div>
  );
}
