export interface UpdateStaffCommand {
  readonly userId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly showroomId: string | null;
}
