-- 0004_participation (down): drops what the up migration created, dependants first.

DROP TABLE "reading_positions";
DROP TABLE "bookmarks";
DROP TABLE "circle_requests";
DROP TABLE "circle_progress";
DROP TABLE "attendance";
DROP TABLE "consents";
DROP TABLE "follows";
DROP TABLE "registrations";
