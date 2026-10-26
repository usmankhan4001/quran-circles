-- 0015_email_sign_in (down): reverses the up migration.
-- Lossy by design: accounts created by email have no verified number, so they are removed with
-- everything that hangs off them (their registrations, sessions, roles). Only run it before email
-- accounts exist, or after exporting them. Pending email codes are dropped.

DELETE FROM "users" WHERE "phone_verified_at" IS NULL;
DROP INDEX "coordinator_invites_email_idx";
ALTER TABLE "coordinator_invites" DROP CONSTRAINT "coordinator_invites_email_chk";
ALTER TABLE "coordinator_invites" DROP COLUMN "email";

DELETE FROM "otp_challenges" WHERE "phone_e164" IS NULL;
DROP INDEX "otp_challenges_email_created_idx";
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_claimed_phone_e164_chk";
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_target_chk";
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_channel_chk";
DELETE FROM "otp_challenges" WHERE "channel" = 'email';
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_channel_chk" CHECK ("channel" IN ('whatsapp', 'sms'));
ALTER TABLE "otp_challenges" ALTER COLUMN "phone_e164" SET NOT NULL;
ALTER TABLE "otp_challenges" DROP COLUMN "claimed_phone_e164";
ALTER TABLE "otp_challenges" DROP COLUMN "email";

DROP INDEX "users_email_uq";
ALTER TABLE "users" DROP CONSTRAINT "users_identity_chk";
ALTER TABLE "users" DROP CONSTRAINT "users_email_chk";
ALTER TABLE "users" ALTER COLUMN "phone_verified_at" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "email_verified_at";
ALTER TABLE "users" DROP COLUMN "email";
