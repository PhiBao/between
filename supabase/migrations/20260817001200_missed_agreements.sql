-- Between — the passage of time as a recorded fact.
--
-- An agreement that was confirmed, had a due date, and was never marked done
-- becomes "missed". That is a factual statement about the record, so it is
-- written by the database with an audit row attached, exactly like a human
-- action, and attributed to Between rather than to either parent.
--
-- The grace period exists so that someone who marks a handover done an hour
-- late is not recorded as having missed it.

alter table public.agreement_events
  drop constraint agreement_events_action_check;

alter table public.agreement_events
  add constraint agreement_events_action_check check (action in (
    'created', 'confirmed', 'declined', 'marked_done', 'due_changed', 'marked_missed'
  ));

create or replace function public.mark_missed_agreements(
  p_grace_hours int default 24
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agreement record;
  v_count int := 0;
begin
  for v_agreement in
    select id, family_id
    from public.agreements
    where status = 'confirmed'
      and due_at is not null
      and due_at < now() - make_interval(hours => greatest(p_grace_hours, 0))
    for update skip locked
  loop
    update public.agreements
      set status = 'missed', updated_at = now()
      where id = v_agreement.id;

    insert into public.agreement_events
      (agreement_id, family_id, actor_id, actor_name, action, detail)
    values
      (v_agreement.id, v_agreement.family_id, null, 'Between', 'marked_missed',
       'due date passed without being marked done');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Only the service role runs this, from the scheduled job.
revoke all on function public.mark_missed_agreements(int) from public;
revoke all on function public.mark_missed_agreements(int) from authenticated;
grant execute on function public.mark_missed_agreements(int) to service_role;
