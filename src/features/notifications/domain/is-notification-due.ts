export function isNotificationDue(dueAt: Date | null, now: Date): boolean {
  return dueAt === null || dueAt.getTime() <= now.getTime();
}
