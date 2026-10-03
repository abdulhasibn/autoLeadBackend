export interface CreateStaffCommand {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly password: string;
  readonly showroomId: string | null;
  readonly roles: readonly string[];
}
