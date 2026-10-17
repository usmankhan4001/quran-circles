import type { Handlers } from './shared/route';
import { attendanceHandlers } from './attendance/routes';
import { circleHandlers } from './circles/routes';
import { importHandlers } from './import/routes';
import { meHandlers } from './me/routes';
import { oversightHandlers } from './oversight/routes';
import { placesHandlers } from './places/routes';
import { posterHandlers } from './posters/routes';
import { readingHandlers } from './reading/routes';
import { registrationHandlers } from './registrations/routes';
import { roleHandlers } from './roles/routes';
import { sessionHandlers } from './sessions/routes';
import { systemHandlers } from './system/routes';
import { updateHandlers } from './updates/routes';
import { venueHandlers } from './venues/routes';

/**
 * Every endpoint of the contract registry except the four sign-in endpoints, which the
 * auth-scopes lane serves with `authRoutes(deps)`.
 */
export function allHandlers(): Handlers[] {
  return [
    systemHandlers(),
    placesHandlers(),
    venueHandlers(),
    sessionHandlers(),
    registrationHandlers(),
    updateHandlers(),
    meHandlers(),
    circleHandlers(),
    roleHandlers(),
    attendanceHandlers(),
    oversightHandlers(),
    importHandlers(),
    readingHandlers(),
    posterHandlers(),
  ];
}
