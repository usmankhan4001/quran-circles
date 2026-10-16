-- 0003_programs (down): drops what the up migration created, dependants first.

DROP TABLE "occurrences";
DROP TABLE "sessions";
DROP TABLE "circles";
DROP TABLE "seasons";
DROP TABLE "programs";
