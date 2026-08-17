-- Between — initial schema
--
-- Design notes (the threat model is "the other parent", so authorization is
-- enforced in the database, not in the application):
--
--  1. Every table is protected by RLS and scoped through membership of a family.
--  2. `entries` and `agreement_events` are APPEND-ONLY: no UPDATE or DELETE
--     policy exists for application users, so those statements are denied by
--     default-deny RLS.
--  3. Every entry carries a hash chain (`prev_hash` -> `hash`). The client
--     computes the hash, and a database trigger RECOMPUTES it and rejects the
--     row if it does not match, so a client cannot forge the chain.
--  4. Message drafts are never stored. Only what the user actually sent.
--  5. `ai_events` holds counters only — never message text.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- families ---

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  label       text not null default 'Our record',
  created_at  timestamptz not null default now()
);

create type public.membership_status as enum ('active', 'invited');

create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null check (length(trim(display_name)) between 1 and 60),
  status        public.membership_status not null default 'active',
  created_at    timestamptz not null default now(),
  unique (family_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

create table public.children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

create index children_family_idx on public.children (family_id);

-- Invite tokens: only a hash of the token is stored, so a database leak does
-- not hand out family access.
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  token_hash   text not null unique,
  created_by   uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------- entries ---

create type public.entry_kind as enum ('sent', 'logged_external');

create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  seq           bigint not null check (seq > 0),
  kind          public.entry_kind not null,
  author_id     uuid not null references auth.users(id),
  author_name   text not null,
  body          text not null check (length(body) between 1 and 4000),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  rewrite_used  boolean not null default false,
  prev_hash     char(64) not null,
  hash          char(64) not null,
  unique (family_id, seq),
  unique (family_id, hash)
);

create index entries_family_seq_idx on public.entries (family_id, seq desc);

-- Canonical string that gets hashed. Kept in one function so the SQL trigger
-- and the TypeScript implementation cannot drift apart silently.
create or replace function public.entry_canonical(
  p_seq bigint,
  p_family_id uuid,
  p_kind text,
  p_author_id uuid,
  p_occurred_at timestamptz,
  p_body text,
  p_prev_hash text
) returns text
language sql
immutable
as $$
  select concat_ws(
    '|',
    p_seq::text,
    p_family_id::text,
    p_kind,
    p_author_id::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    encode(digest(p_body, 'sha256'), 'hex'),
    p_prev_hash
  );
$$;

create or replace function public.entries_chain_guard()
returns trigger
language plpgsql
as $$
declare
  v_prev_hash char(64);
  v_prev_seq  bigint;
  v_expected  char(64);
begin
  -- Serialize appends per family so two concurrent sends cannot claim the
  -- same seq or the same prev_hash.
  perform pg_advisory_xact_lock(hashtextextended(new.family_id::text, 0));

  select hash, seq into v_prev_hash, v_prev_seq
  from public.entries
  where family_id = new.family_id
  order by seq desc
  limit 1;

  if v_prev_seq is null then
    if new.seq <> 1 then
      raise exception 'first entry must have seq 1, got %', new.seq;
    end if;
    if new.prev_hash <> repeat('0', 64) then
      raise exception 'first entry must chain from the zero hash';
    end if;
  else
    if new.seq <> v_prev_seq + 1 then
      raise exception 'entry seq must be % , got %', v_prev_seq + 1, new.seq;
    end if;
    if new.prev_hash <> v_prev_hash then
      raise exception 'prev_hash does not match the previous entry';
    end if;
  end if;

  v_expected := encode(
    digest(
      public.entry_canonical(
        new.seq, new.family_id, new.kind::text, new.author_id,
        new.occurred_at, new.body, new.prev_hash
      ),
      'sha256'
    ),
    'hex'
  );

  if new.hash <> v_expected then
    raise exception 'entry hash does not match its contents';
  end if;

  return new;
end;
$$;

create trigger entries_chain_guard_trg
  before insert on public.entries
  for each row execute function public.entries_chain_guard();

-- "Read" is recorded as its own immutable fact rather than a mutable column on
-- `entries`, so the record itself never has to be updated in place.
create table public.entry_reads (
  entry_id   uuid not null references public.entries(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (entry_id, user_id)
);

create index entry_reads_family_idx on public.entry_reads (family_id);

-- -------------------------------------------------------------- agreements ---

create type public.agreement_status as enum
  ('proposed', 'confirmed', 'declined', 'done', 'missed');

create table public.agreements (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  entry_id      uuid not null references public.entries(id) on delete cascade,
  text          text not null check (length(text) between 1 and 400),
  source_quote  text not null check (length(source_quote) between 1 and 1000),
  owner         text not null check (owner in ('author', 'other', 'both')),
  due_at        timestamptz,
  status        public.agreement_status not null default 'proposed',
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index agreements_family_idx on public.agreements (family_id, created_at desc);

create table public.agreement_events (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.agreements(id) on delete cascade,
  family_id     uuid not null references public.families(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  actor_name    text not null,
  action        text not null check (action in
                  ('created', 'confirmed', 'declined', 'marked_done', 'due_changed')),
  detail        text,
  created_at    timestamptz not null default now()
);

create index agreement_events_agreement_idx
  on public.agreement_events (agreement_id, created_at);

-- ------------------------------------------------------------------- packs ---

create table public.packs (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  created_by        uuid not null references auth.users(id),
  range_start       timestamptz not null,
  range_end         timestamptz not null,
  entry_count       int not null,
  agreement_count   int not null,
  head_hash         char(64) not null,
  created_at        timestamptz not null default now()
);

create index packs_family_idx on public.packs (family_id, created_at desc);

-- --------------------------------------------------------------- ai_events ---
-- Counters only. Storing message text here would defeat the product's promise.

create table public.ai_events (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid references public.families(id) on delete set null,
  user_id      uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('rewrite', 'extract')),
  outcome      text not null check (outcome in
                 ('shown', 'accepted', 'sent_as_written', 'blocked_facts',
                  'blocked_safety', 'error')),
  model        text,
  latency_ms   int,
  input_chars  int,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------- RLS ---

create or replace function public.is_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

alter table public.families         enable row level security;
alter table public.memberships      enable row level security;
alter table public.children         enable row level security;
alter table public.invites          enable row level security;
alter table public.entries          enable row level security;
alter table public.entry_reads      enable row level security;
alter table public.agreements       enable row level security;
alter table public.agreement_events enable row level security;
alter table public.packs            enable row level security;
alter table public.ai_events        enable row level security;

-- families: readable by members. Creation happens through a security-definer
-- function so a user cannot create a family they are not a member of.
create policy families_select on public.families
  for select to authenticated using (public.is_member(id));

create policy memberships_select on public.memberships
  for select to authenticated using (public.is_member(family_id));

create policy children_select on public.children
  for select to authenticated using (public.is_member(family_id));
create policy children_insert on public.children
  for insert to authenticated with check (public.is_member(family_id));

-- Invites are readable only by the family that owns them; tokens are hashed so
-- reading a row does not reveal a usable token.
create policy invites_select on public.invites
  for select to authenticated using (public.is_member(family_id));
create policy invites_insert on public.invites
  for insert to authenticated
  with check (public.is_member(family_id) and created_by = auth.uid());

-- entries: SELECT and INSERT only. No UPDATE/DELETE policy => append-only.
create policy entries_select on public.entries
  for select to authenticated using (public.is_member(family_id));
create policy entries_insert on public.entries
  for insert to authenticated
  with check (public.is_member(family_id) and author_id = auth.uid());

create policy entry_reads_select on public.entry_reads
  for select to authenticated using (public.is_member(family_id));
create policy entry_reads_insert on public.entry_reads
  for insert to authenticated
  with check (public.is_member(family_id) and user_id = auth.uid());

create policy agreements_select on public.agreements
  for select to authenticated using (public.is_member(family_id));
create policy agreements_insert on public.agreements
  for insert to authenticated
  with check (public.is_member(family_id) and created_by = auth.uid());

-- agreement_events: append-only audit trail.
create policy agreement_events_select on public.agreement_events
  for select to authenticated using (public.is_member(family_id));

create policy packs_select on public.packs
  for select to authenticated using (public.is_member(family_id));
create policy packs_insert on public.packs
  for insert to authenticated
  with check (public.is_member(family_id) and created_by = auth.uid());

-- ai_events: a user may write their own counters and read nothing back.
create policy ai_events_insert on public.ai_events
  for insert to authenticated with check (user_id = auth.uid());

-- Belt and braces: even if a policy is added later by mistake, these grants
-- keep the append-only tables append-only.
revoke update, delete on public.entries from authenticated;
revoke update, delete on public.agreement_events from authenticated;
