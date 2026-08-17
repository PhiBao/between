-- Between — operations that must be atomic and rule-checked.
--
-- These run as SECURITY DEFINER because they do more than one write and the
-- rules between those writes are the product's rules:
--
--   * creating a family also makes you its first member
--   * accepting an invite is single-use, time limited, and capped at two parents
--   * changing an agreement's status always writes an audit row in the same
--     transaction, and only the OTHER parent may confirm or decline
--
-- Every function re-checks authorization itself; none of them trust the caller.

-- ------------------------------------------------------------ create family ---

create or replace function public.create_family(
  p_display_name text,
  p_children text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_child text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'display name is required';
  end if;

  insert into public.families (label) values ('Our record')
  returning id into v_family_id;

  insert into public.memberships (family_id, user_id, display_name, status)
  values (v_family_id, auth.uid(), trim(p_display_name), 'active');

  foreach v_child in array coalesce(p_children, '{}')
  loop
    if length(trim(v_child)) > 0 then
      insert into public.children (family_id, name) values (v_family_id, trim(v_child));
    end if;
  end loop;

  return v_family_id;
end;
$$;

-- ---------------------------------------------------------------- invites ----

create or replace function public.accept_invite(
  p_token_hash text,
  p_display_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_active_parents int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where token_hash = p_token_hash
  for update;

  if v_invite.id is null then
    raise exception 'invite not found';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite already used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite expired';
  end if;

  -- Already a member? Then accepting is a no-op that still burns the token.
  if exists (
    select 1 from public.memberships
    where family_id = v_invite.family_id and user_id = auth.uid()
  ) then
    update public.invites
      set accepted_at = now(), accepted_by = auth.uid()
      where id = v_invite.id;
    return v_invite.family_id;
  end if;

  select count(*) into v_active_parents
  from public.memberships
  where family_id = v_invite.family_id and status = 'active';

  if v_active_parents >= 2 then
    raise exception 'this record already has two parents';
  end if;

  insert into public.memberships (family_id, user_id, display_name, status)
  values (v_invite.family_id, auth.uid(), trim(p_display_name), 'active');

  update public.invites
    set accepted_at = now(), accepted_by = auth.uid()
    where id = v_invite.id;

  return v_invite.family_id;
end;
$$;

-- ------------------------------------------------------------- agreements ----

-- Creating an agreement from an entry, together with its first audit row.
create or replace function public.create_agreement(
  p_entry_id uuid,
  p_text text,
  p_source_quote text,
  p_owner text,
  p_due_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_actor_name text;
  v_agreement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select family_id into v_family_id from public.entries where id = p_entry_id;
  if v_family_id is null then
    raise exception 'entry not found';
  end if;

  select display_name into v_actor_name
  from public.memberships
  where family_id = v_family_id and user_id = auth.uid() and status = 'active';

  if v_actor_name is null then
    raise exception 'not a member of this record';
  end if;

  if p_owner not in ('author', 'other', 'both') then
    raise exception 'invalid owner';
  end if;

  -- The quote must genuinely appear in the entry it claims to come from.
  -- Provenance is the whole point of the record, so this is checked, not trusted.
  if not exists (
    select 1 from public.entries
    where id = p_entry_id and position(trim(p_source_quote) in body) > 0
  ) then
    raise exception 'source quote is not part of that message';
  end if;

  insert into public.agreements
    (family_id, entry_id, text, source_quote, owner, due_at, status, created_by)
  values
    (v_family_id, p_entry_id, trim(p_text), trim(p_source_quote), p_owner,
     p_due_at, 'proposed', auth.uid())
  returning id into v_agreement_id;

  insert into public.agreement_events
    (agreement_id, family_id, actor_id, actor_name, action, detail)
  values
    (v_agreement_id, v_family_id, auth.uid(), v_actor_name, 'created', null);

  return v_agreement_id;
end;
$$;

-- Status transitions. The rules live here so both the UI and any future client
-- get the same behaviour.
create or replace function public.set_agreement_status(
  p_agreement_id uuid,
  p_action text,
  p_due_at timestamptz default null
) returns public.agreement_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agreement public.agreements;
  v_actor_name text;
  v_new_status public.agreement_status;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if v_agreement.id is null then
    raise exception 'agreement not found';
  end if;

  select display_name into v_actor_name
  from public.memberships
  where family_id = v_agreement.family_id
    and user_id = auth.uid()
    and status = 'active';

  if v_actor_name is null then
    raise exception 'not a member of this record';
  end if;

  if p_action in ('confirmed', 'declined') then
    -- Only the other parent can confirm or decline. Confirming your own
    -- commitment would make the record meaningless.
    if v_agreement.created_by = auth.uid() then
      raise exception 'only the other parent can respond to this';
    end if;
    if v_agreement.status <> 'proposed' then
      raise exception 'this has already been answered';
    end if;
    v_new_status := p_action::public.agreement_status;

    update public.agreements
      set status = v_new_status, updated_at = now()
      where id = p_agreement_id;

    insert into public.agreement_events
      (agreement_id, family_id, actor_id, actor_name, action, detail)
    values
      (p_agreement_id, v_agreement.family_id, auth.uid(), v_actor_name, p_action, null);

  elsif p_action = 'marked_done' then
    if v_agreement.status not in ('proposed', 'confirmed') then
      raise exception 'this cannot be marked done from its current state';
    end if;
    v_new_status := 'done';

    update public.agreements
      set status = v_new_status, updated_at = now()
      where id = p_agreement_id;

    insert into public.agreement_events
      (agreement_id, family_id, actor_id, actor_name, action, detail)
    values
      (p_agreement_id, v_agreement.family_id, auth.uid(), v_actor_name,
       'marked_done', null);

  elsif p_action = 'due_changed' then
    v_new_status := v_agreement.status;

    update public.agreements
      set due_at = p_due_at, updated_at = now()
      where id = p_agreement_id;

    insert into public.agreement_events
      (agreement_id, family_id, actor_id, actor_name, action, detail)
    values
      (p_agreement_id, v_agreement.family_id, auth.uid(), v_actor_name,
       'due_changed',
       case when p_due_at is null then 'cleared'
            else to_char(p_due_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI"Z"') end);

  else
    raise exception 'unknown action %', p_action;
  end if;

  return v_new_status;
end;
$$;

-- Only these functions may be called by signed-in users.
revoke all on function public.create_family(text, text[]) from public;
revoke all on function public.accept_invite(text, text) from public;
revoke all on function public.create_agreement(uuid, text, text, text, timestamptz) from public;
revoke all on function public.set_agreement_status(uuid, text, timestamptz) from public;

grant execute on function public.create_family(text, text[]) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.create_agreement(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.set_agreement_status(uuid, text, timestamptz) to authenticated;
