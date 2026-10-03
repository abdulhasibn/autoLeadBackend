-- Unique live email for login identity. Phone unique index is unchanged.

create unique index users_email_active_uidx
  on public.users (email)
  where deleted_at is null and email is not null;
