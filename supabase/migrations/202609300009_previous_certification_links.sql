-- Link renewal and grade-change Jobs to a completed prior certification.
alter table public.jobs
  add column if not exists previous_job_id uuid references public.jobs(id);

create index if not exists jobs_previous_job_id_idx on public.jobs(previous_job_id);

create or replace function public.validate_previous_job_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.previous_job_id is null then return new; end if;
  if new.previous_job_id = new.id then raise exception 'A Job cannot reference itself'; end if;
  if not exists (
    select 1
      from public.jobs previous_job
      join public.processing_cycles previous_cycle on previous_cycle.job_id = previous_job.id and previous_cycle.status = 'COMPLETED'
      join public.certification_records previous_record on previous_record.job_id = previous_job.id and previous_record.history_state = 'CURRENT'
     where previous_job.id = new.previous_job_id
       and previous_job.candidate_id = new.candidate_id
       and previous_job.standard = new.standard
  ) then
    raise exception 'Previous Job must be a completed current certification for the same candidate and standard';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_previous_job_link_trigger on public.jobs;
create trigger validate_previous_job_link_trigger
before insert or update of previous_job_id, candidate_id, standard on public.jobs
for each row execute function public.validate_previous_job_link();
