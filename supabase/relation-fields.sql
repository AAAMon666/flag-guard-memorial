alter table public.members add column if not exists gender text not null default '';
alter table public.media_items add column if not exists taken_date text;
