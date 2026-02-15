-- Run this in Supabase SQL editor.
-- This adds "shared inventory" membership + invite tracking.

-- 1) Tables
create table if not exists public.inventory_members (
  owner_id uuid not null,
  member_id uuid not null,
  member_email text,
  role text not null default 'editor', -- 'editor' | 'viewer'
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id)
);

create index if not exists inventory_members_member_id_idx on public.inventory_members (member_id);

create table if not exists public.inventory_invites (
  owner_id uuid not null,
  email text not null,
  role text not null default 'editor', -- 'editor' | 'viewer'
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (owner_id, email)
);

-- If tables already exist, ensure new columns exist
alter table public.inventory_members add column if not exists role text not null default 'editor';
alter table public.inventory_invites add column if not exists role text not null default 'editor';

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
drop policy if exists "locations shared select" on public.locations;
drop policy if exists "locations shared write" on public.locations;
drop policy if exists "locations shared insert" on public.locations;
drop policy if exists "locations shared update" on public.locations;
drop policy if exists "locations shared delete" on public.locations;

create policy "locations shared select" on public.locations
for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
  )
);

create policy "locations shared insert" on public.locations
for insert to authenticated
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
      and m.role = 'editor'
  )
);

create policy "locations shared update" on public.locations
for update to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
      and m.role = 'editor'
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
      and m.role = 'editor'
  )
);

create policy "locations shared delete" on public.locations
for delete to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = locations.owner_id
      and m.role = 'editor'
  )
);

-- BOXES
alter table public.boxes enable row level security;

-- Box-level privacy: hide a box from view-only members
alter table public.boxes add column if not exists hidden_from_viewers boolean not null default false;

drop policy if exists "boxes shared access" on public.boxes;
drop policy if exists "boxes shared select" on public.boxes;
drop policy if exists "boxes shared write" on public.boxes;
drop policy if exists "boxes shared insert" on public.boxes;
drop policy if exists "boxes shared update" on public.boxes;
drop policy if exists "boxes shared delete" on public.boxes;

create policy "boxes shared select" on public.boxes
for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
      and m.role = 'editor'
  )
  or (
    hidden_from_viewers = false
    and exists (
      select 1 from public.inventory_members m
      where m.member_id = auth.uid()
        and m.owner_id = boxes.owner_id
        and m.role = 'viewer'
    )
  )
);

create policy "boxes shared insert" on public.boxes
for insert to authenticated
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
      and m.role = 'editor'
  )
);

create policy "boxes shared update" on public.boxes
for update to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
      and m.role = 'editor'
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
      and m.role = 'editor'
  )
);

create policy "boxes shared delete" on public.boxes
for delete to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = boxes.owner_id
      and m.role = 'editor'
  )
);

-- ITEMS
alter table public.items enable row level security;

drop policy if exists "items shared access" on public.items;
drop policy if exists "items shared select" on public.items;
drop policy if exists "items shared write" on public.items;
drop policy if exists "items shared insert" on public.items;
drop policy if exists "items shared update" on public.items;
drop policy if exists "items shared delete" on public.items;

create policy "items shared select" on public.items
for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'editor'
  )
  or exists (
    select 1
    from public.inventory_members m
    join public.boxes b on b.id = items.box_id
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'viewer'
      and b.owner_id = items.owner_id
      and b.hidden_from_viewers = false
  )
);

create policy "items shared insert" on public.items
for insert to authenticated
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'editor'
  )
);

create policy "items shared update" on public.items
for update to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'editor'
  )
)
with check (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'editor'
  )
);

create policy "items shared delete" on public.items
for delete to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.inventory_members m
    where m.member_id = auth.uid()
      and m.owner_id = items.owner_id
      and m.role = 'editor'
  )
);
