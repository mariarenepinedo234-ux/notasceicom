CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
ALTER TABLE "User"
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'TEACHER',
  ADD COLUMN "ci" VARCHAR(30),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_ci_key" ON "User"("ci");
UPDATE "User" SET "role" = 'STUDENT' WHERE "id" IN (SELECT "userId" FROM "Student");
UPDATE "User" SET "role" = 'ADMIN' WHERE "isSuperuser" = true;
