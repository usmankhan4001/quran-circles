import type { z } from 'zod';
import type {
  Attendance as AttendanceSchema,
  BookmarkImport as BookmarkImportSchema,
  CircleCreate as CircleCreateSchema,
  CircleRequestCreate as CircleRequestCreateSchema,
  ReadingPosition as ReadingPositionSchema,
  ScheduleChangeResponse as ScheduleChangeResponseSchema,
  StaffRoleAssignment as StaffRoleAssignmentSchema,
  VenueUpdate as VenueUpdateSchema,
} from '@qc/contracts';

/**
 * Types for contract schemas that the contract package exports as values only. Derived from the
 * schemas, so they cannot drift.
 */
export type Attendance = z.infer<typeof AttendanceSchema>;
export type BookmarkImport = z.infer<typeof BookmarkImportSchema>;
export type CircleCreate = z.infer<typeof CircleCreateSchema>;
export type CircleRequestCreate = z.infer<typeof CircleRequestCreateSchema>;
export type ReadingPosition = z.infer<typeof ReadingPositionSchema>;
export type ScheduleChangeResponse = z.infer<typeof ScheduleChangeResponseSchema>;
export type StaffRoleAssignment = z.infer<typeof StaffRoleAssignmentSchema>;
export type VenueUpdate = z.infer<typeof VenueUpdateSchema>;
