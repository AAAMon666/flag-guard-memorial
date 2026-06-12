create or replace function public.verify_media_edit_password(media_id uuid, plain_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.media_items media
    where media.id = media_id
      and (
        media.edit_password_hash is null
        or media.edit_password_hash = public.hash_media_password(plain_password)
      )
  );
$$;
