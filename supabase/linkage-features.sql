insert into public.system_settings (key, value)
values
  ('imageUploadEnabled', 'true'::jsonb),
  ('videoUploadEnabled', 'true'::jsonb),
  ('messageEnabled', 'true'::jsonb),
  ('mediaStorageQuotaBytes', to_jsonb(10737418240::bigint))
on conflict (key) do nothing;

drop function if exists public.get_media_storage_status();
create or replace function public.get_media_storage_status()
returns table (
  used_bytes bigint,
  total_bytes bigint,
  remaining_bytes bigint,
  usage_percent numeric,
  object_count bigint
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with quota as (
    select coalesce((value #>> '{}')::bigint, 0) as total_bytes
    from public.system_settings
    where key = 'mediaStorageQuotaBytes'
  ), usage_stats as (
    select
      coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0) as used_bytes,
      count(*)::bigint as object_count
    from storage.objects
    where bucket_id = 'media'
  )
  select
    usage_stats.used_bytes,
    quota.total_bytes,
    greatest(quota.total_bytes - usage_stats.used_bytes, 0) as remaining_bytes,
    case
      when quota.total_bytes > 0 then round((usage_stats.used_bytes::numeric / quota.total_bytes::numeric) * 100, 2)
      else 0
    end as usage_percent,
    usage_stats.object_count
  from usage_stats
  cross join quota;
$$;

drop policy if exists "public read members" on public.members;
create policy "public read members" on public.members for select using (true);
