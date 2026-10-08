/**
 * Read-model DTO returned by GET /auth/me.
 * Shaped for the caller; database row types must not cross this boundary.
 */
export interface UserProfileDto {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly roles: ReadonlyArray<string>;
  /** Home showroom; null for staff not tied to one. */
  readonly showroomId: string | null;
}
