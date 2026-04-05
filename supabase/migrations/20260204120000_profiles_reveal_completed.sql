-- Run in Supabase SQL editor (or via CLI) so reveal routing can use the database.
alter table public.profiles
  add column if not exists reveal_completed boolean not null default false;

comment on column public.profiles.reveal_completed is
  'User finished the post-questions reveal screen (Start My Journey).';
