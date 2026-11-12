# Push notifications

Every in-app notification (any insert into `public.notifications`, from SQL
functions or the API) is also pushed to the recipient's phones.

## Flow

1. The dealer app gets an Expo push token and `PUT /notifications/push-devices`
   (token, platform, `enabled`). One row per device in `device_push_tokens`, so a
   staff member signed in on several phones gets the push on all of them whose
   switch is on.
2. A statement trigger on `notifications` calls `request_push_dispatch()`, which
   POSTs (pg_net, async) to `POST /internal/push/dispatch` with `x-push-secret`.
3. The API calls `claim_pending_pushes()` (marks rows `push_sent_at`, so nothing
   is sent twice), looks up the enabled devices of each recipient and sends via
   the Expo push service. Tokens Expo reports as `DeviceNotRegistered` are deleted.
4. `pg_cron` calls the same function every minute: this delivers follow-up
   reminders whose `due_at` was in the future at insert time, and retries a
   missed trigger. Reminders can be set for any future date. Unread, unpushed notifications that became due more than a day ago are not sent, and the migration marks everything already due at that point as skipped so old data never floods phones.

A failed send is logged and not retried (the notification stays in the inbox).

## One-time setup per environment

1. Set `PUSH_DISPATCH_SECRET` (16+ chars) on the API host. Set `EXPO_ACCESS_TOKEN`
   only if enhanced push security is on for the Expo project.
2. Apply migration `20261112120000_push_notifications`.
3. Tell the database where the API is:

```sql
insert into public.push_dispatch_config (url, secret)
values ('https://<api-host>/internal/push/dispatch', '<PUSH_DISPATCH_SECRET>')
on conflict (singleton) do update set url = excluded.url, secret = excluded.secret;
```

Until this row exists nothing is pushed (the app still works).

4. Mobile: upload the FCM v1 key (Android) and APNs key (iOS) with `eas credentials`.

## API

| Method | Path | Result |
|---|---|---|
| `PUT` | `/notifications/push-devices` | `204`. Body `{ token, platform: "ios"\|"android", enabled?: true }`. Upsert by token; a token moves to whoever signs in last on that phone. `enabled:false` is the in-app switch off. |
| `DELETE` | `/notifications/push-devices?token=` | `204`. Forgets this device for the caller (call on sign-out). |
| `POST` | `/internal/push/dispatch` | `200 { notifications, pushes }`. Database only; `x-push-secret` header. |

Push payload `data`: `notificationId`, `type`, `entityType`, `entityId`.

## Rollout checks

- Cron is scheduled (the migration only raises a notice if `pg_cron` is missing, so a
  failure is silent): `select jobname from cron.job where jobname = 'push-dispatch-sweep';`
  must return one row.
- Config row exists: `select url from public.push_dispatch_config;`.
- The push functions and tables are service-role only. `request_push_dispatch()`,
  `claim_pending_pushes()`, `device_push_tokens` and `push_dispatch_config` are revoked from
  `anon` and `authenticated`, so the public key cannot call them over PostgREST.
- Failures: if the device lookup fails the claimed batch is released and retried next minute.
  A failed Expo chunk is logged and does not stop the other chunks; those pushes are not retried.
