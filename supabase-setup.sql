create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    username text not null default 'User',
    role text not null default 'user' check (role in ('user', 'admin')),
    created_at timestamptz not null default now()
);

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    type text not null,
    area text not null,
    description text not null,
    photo_data_url text not null default '',
    created_at timestamptz not null default now(),
    status text not null default 'Pending'
        check (status in ('Pending', 'On-going', 'Resolved', 'Archived')),
    confirmed_at timestamptz,
    scheduled_at timestamptz,
    resolved_at timestamptz,
    archived_at timestamptz
);

create index if not exists reports_user_created_at_idx
    on public.reports (user_id, created_at desc);

create or replace function public.is_monitor_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'admin'
    );
$$;

revoke all on function public.is_monitor_admin() from public;
grant execute on function public.is_monitor_admin() to authenticated;

create or replace function public.create_monitor_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, username)
    values (
        new.id,
        new.email,
        coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'User')
    )
    on conflict (id) do update
    set email = excluded.email;
    return new;
end;
$$;

drop trigger if exists on_monitor_user_created on auth.users;
create trigger on_monitor_user_created
    after insert on auth.users
    for each row execute procedure public.create_monitor_profile();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
grant usage on schema public to authenticated;

drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Users and admins can read profiles"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()) or (select public.is_monitor_admin()));

drop policy if exists "Users can read their own reports and admins can read all" on public.reports;
create policy "Users can read their own reports and admins can read all"
    on public.reports for select to authenticated
    using (user_id = (select auth.uid()) or (select public.is_monitor_admin()));

drop policy if exists "Users can submit their own pending reports" on public.reports;
create policy "Users can submit their own pending reports"
    on public.reports for insert to authenticated
    with check (
        user_id = (select auth.uid())
        and status = 'Pending'
    );

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
    on public.reports for update to authenticated
    using ((select public.is_monitor_admin()))
    with check ((select public.is_monitor_admin()));

grant select on public.profiles to authenticated;
grant select, insert, update on public.reports to authenticated;
