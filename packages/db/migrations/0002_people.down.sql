-- 0002_people (down): drops what the up migration created, dependants first.

DROP TABLE "coordinator_invites";
DROP TABLE "auth_sessions";
DROP TABLE "otp_challenges";
DROP TABLE "devices";
DROP TABLE "role_assignments";
DROP TABLE "profiles";
DROP TABLE "users";
