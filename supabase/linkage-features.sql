insert into public.system_settings (key, value)
values
  ('imageUploadEnabled', 'true'::jsonb),
  ('videoUploadEnabled', 'true'::jsonb),
  ('messageEnabled', 'true'::jsonb)
on conflict (key) do nothing;

drop policy if exists "public read members" on public.members;
create policy "public read members" on public.members for select using (true);
