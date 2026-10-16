-- 0007_settings_audit_legacy (down): drops what the up migration created, dependants first.

DROP TABLE "legacy_whatsapp_subscribers";
DROP TABLE "legacy_registrations";
DROP TABLE "audit_log";
DROP TABLE "feature_flags";
DROP TABLE "settings";
