-- `User.isActive` was added to schema.prisma without a migration, so the generated
-- client selected a column the database did not have. Every code path that reads it
-- failed with P2022 (ColumnNotFound) - including login, `authenticate`, and admin
-- user management, which made the whole authenticated surface unreachable.
--
-- Additive and defaulted, so existing users come back enabled.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
