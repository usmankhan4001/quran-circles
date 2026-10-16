import type { ApiClient } from '@qc/contracts';

/** The contract exports the schema but not its type for role assignments, so derive it here. */
export type StaffRoleAssignment = Awaited<
  ReturnType<ApiClient['adminRoles']['list']>
>['items'][number];
