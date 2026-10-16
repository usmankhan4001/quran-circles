-- 0005_messaging (down): drops what the up migration created, dependants first.

DROP TABLE "message_outbox";
DROP TABLE "message_templates";
DROP TABLE "update_reads";
DROP TABLE "updates";
