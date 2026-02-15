-- Run this in Supabase SQL editor.
-- This adds "shared inventory" membership + invite tracking.

-- 1) Tables
create table if not exists public.inventory_members (
  owner_id uuid not null,
  member_id uuid not null,
  member_email text,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id)
);

create index if not exists inventory_members_member_id_idx on public.inventory_members (member_id);

create table if not exists public.inventory_invites (
  owner_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (owner_id, email)
);

-- 2) RLS (adjust if you already have policies)
alter table public.inventory_members enable row level security;
alter table public.inventory_invites enable row level security;

-- Members can read their membership
drop policy if exists "members can read" on public.inventory_members;
create policy "members can read" on public.inventory_members
for select to authenticated
using (member_id = auth.uid());

-- Owners can manage membership
drop policy if exists "owners manage membership" on public.inventory_members;
create policy "owners manage membership" on public.inventory_members
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Owners can manage invites
drop policy if exists "owners manage invites" on public.inventory_invites;
create policy "owners manage invites" on public.inventory_invites
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- 3) Example "shared access" policies for your existing tables.
-- If you already have RLS, modify your existing policies instead of blindly adding.
-- Pattern: allow access if owner_id is you OR you are a member of that owner.

-- LOCATIONS
alter table public.locations enable row level security;

drop policy if exists "locations shared access" on public.locations;
create policy "locations shared access" on public.locations
for all to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
  )
);

-- BOXES
alter table public.boxes enable row level security;

drop policy if exists "boxes shared access" on public.boxes;
create policy "boxes shared access" on public.boxes
for all to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
  )
);

-- ITEMS
alter table public.items enable row level security;

drop policy if exists "items shared access" on public.items;
create policy "items shared access" on public.items
for all to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
  )
);
