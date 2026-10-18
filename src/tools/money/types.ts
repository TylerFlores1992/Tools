// Shapes shared by the money tracker's logic (pure, tested) and its server code.

/** Who an account belongs to. Shown as words, never colour. */
export type Owner = "mine" | "joint" | "hers";

export type Account = {
  id: string;
  orgName: string | null;
  name: string;
  displayName: string | null;
  owner: Owner | null;
  currency: string;
  balance: number | null;
  availableBalance: number | null;
  balanceDate: string | null; // ISO
  hidden: boolean;
};

export type CategorySource = "auto" | "rule" | "manual";

export type Txn = {
  id: string;
  accountId: string;
  /** YYYY-MM-DD, the day the bank posted it. */
  posted: string;
  /** Negative = money out. */
  amount: number;
  description: string;
  payee: string | null;
  memo: string | null;
  pending: boolean;
  category: string | null;
  categorySource: CategorySource | null;
};

export type Rule = { pattern: string; category: string };
