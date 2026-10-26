-- 0015_email_sign_in
-- Owner decision 2026-10-25: the sign-in code goes to an email address (sent through Resend), not to
-- WhatsApp. The WhatsApp number stays on the account as a required contact field (reminders and
-- coordinator contact) but a code no longer proves it, so it can be unverified.
-- Additive for existing rows: every account made before this keeps its verified number and gains an
-- empty email. Nothing is deleted. WhatsApp sign-in keeps working while AUTH_PHONE_SIGN_IN is on.

-- users: the email is the identity of an account made from now on.
ALTER TABLE "users" ADD COLUMN "email" text;
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;
ALTER TABLE "users" ALTER COLUMN "phone_verified_at" DROP NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_email_chk" CHECK ("email" IS NULL OR ("email" = lower(btrim("email")) AND char_length("email") <= 254 AND "email" ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$'));
-- An account is reachable some way: a verified email or a number verified by a code.
ALTER TABLE "users" ADD CONSTRAINT "users_identity_chk" CHECK (("email" IS NOT NULL AND "email_verified_at" IS NOT NULL) OR "phone_verified_at" IS NOT NULL);
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email") WHERE "email" IS NOT NULL;

-- otp_challenges: a code is asked for by email (or, with WhatsApp sign-in on, by number).
-- `claimed_phone_e164` is the WhatsApp number typed at sign-up: copied to a new account, unverified.
ALTER TABLE "otp_challenges" ADD COLUMN "email" text;
ALTER TABLE "otp_challenges" ADD COLUMN "claimed_phone_e164" text;
ALTER TABLE "otp_challenges" ALTER COLUMN "phone_e164" DROP NOT NULL;
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_channel_chk";
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_channel_chk" CHECK ("channel" IN ('whatsapp', 'sms', 'email'));
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_target_chk" CHECK (("phone_e164" IS NOT NULL) <> ("email" IS NOT NULL));
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_claimed_phone_e164_chk" CHECK ("claimed_phone_e164" IS NULL OR "claimed_phone_e164" ~ '^\+[1-9][0-9]{7,14}$');
CREATE INDEX "otp_challenges_email_created_idx" ON "otp_challenges" USING btree ("email","created_at");

-- coordinator_invites: the address the invitee signs in with. Optional: an invite without one is
-- accepted only by an account whose number was verified by a code.
ALTER TABLE "coordinator_invites" ADD COLUMN "email" text;
ALTER TABLE "coordinator_invites" ADD CONSTRAINT "coordinator_invites_email_chk" CHECK ("email" IS NULL OR "email" = lower(btrim("email")));
CREATE INDEX "coordinator_invites_email_idx" ON "coordinator_invites" USING btree ("email");
