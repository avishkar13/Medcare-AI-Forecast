/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

  Edited by hand after the generated version failed to apply:

    ERROR 23502: column "roleId" of relation "User" contains null values

  The generated ordering added `roleId` as NOT NULL before `Role` existed, which can
  only work on an empty `User` table. Prisma said as much in its own warning above.
  Reordered so the table and a default row exist first, the column arrives nullable,
  every existing user is backfilled onto that role, and only then is NOT NULL applied.

  `roleId` is carried forward from the dropped `role` enum where the names line up, so
  an existing ADMIN stays an admin instead of being flattened to one default.
*/

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- The three roles the old `UserRole` enum held, so an existing user keeps the access
-- they already had. The seed upserts these same names and fills in permissions.
INSERT INTO "Role" ("id", "name", "description", "isSystemRole", "updatedAt") VALUES
  ('role_system_admin',   'ADMIN',   'Full access',                  true, CURRENT_TIMESTAMP),
  ('role_system_planner', 'PLANNER', 'Plans and acts on the network', true, CURRENT_TIMESTAMP),
  ('role_system_viewer',  'VIEWER',  'Read only',                     true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- AlterTable: nullable first, because the table already has rows.
ALTER TABLE "User" ADD COLUMN "roleId" TEXT,
ADD COLUMN     "warehouseId" TEXT;

-- Carry the old enum across before dropping it.
UPDATE "User" u SET "roleId" = r."id" FROM "Role" r WHERE r."name" = u."role"::text;

-- Anything that did not map - a null role, or a value the enum allowed and Role does
-- not - falls back to VIEWER. Least privilege: an unrecognised role must not become
-- an admin by default.
UPDATE "User" SET "roleId" = 'role_system_viewer' WHERE "roleId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
