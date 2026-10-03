import type { ShowroomId } from '../../../domain/shared/showroom-id';

export interface IActiveShowroomLookup {
  isActive(showroomId: ShowroomId): Promise<boolean>;
}
