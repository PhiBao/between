export type EntryKind = "sent" | "logged_external";

export type AgreementStatus =
  | "proposed"
  | "confirmed"
  | "declined"
  | "done"
  | "missed";

export type AgreementOwner = "author" | "other" | "both";

export interface Membership {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
}

export interface FamilyContext {
  familyId: string;
  me: Membership;
  other: Membership | null;
  childNames: string[];
}

export interface RecordEntry {
  id: string;
  seq: number;
  kind: EntryKind;
  authorId: string;
  authorName: string;
  body: string;
  occurredAt: string;
  createdAt: string;
  hash: string;
  prevHash: string;
  rewriteUsed: boolean;
  readByOther: boolean;
  mine: boolean;
}

export interface Agreement {
  id: string;
  entryId: string;
  text: string;
  sourceQuote: string;
  owner: AgreementOwner;
  dueAt: string | null;
  status: AgreementStatus;
  createdBy: string;
  createdAt: string;
  mine: boolean;
  /** True when this agreement is waiting on the signed-in user to answer. */
  awaitingMe: boolean;
  /** True when it has a due date in the past and was never marked done. */
  overdue: boolean;
  events: AgreementEvent[];
}

export interface AgreementEvent {
  action: string;
  actorName: string;
  detail: string | null;
  createdAt: string;
}
