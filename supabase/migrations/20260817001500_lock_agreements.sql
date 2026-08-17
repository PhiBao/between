-- Between — defence in depth on `agreements`, from the pre-submission audit.
--
-- `agreements` is not append-only (status legitimately changes), but every
-- change must go through `set_agreement_status()`, which enforces that only the
-- other parent may confirm or decline and writes the audit row in the same
-- transaction.
--
-- Today RLS blocks direct updates because no UPDATE policy exists. That is a
-- silent guarantee: a future migration could add one by accident and quietly
-- allow a parent to rewrite an agreement's status with no audit trail. The
-- REVOKE makes the intent explicit and survives that mistake.
--
-- The security-definer functions are unaffected: they execute with the
-- privileges of the function owner, not the caller.

revoke update, delete on public.agreements from authenticated;
