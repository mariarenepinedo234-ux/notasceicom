CREATE TABLE "User" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(150) NOT NULL UNIQUE,
  "password" VARCHAR(256) NOT NULL,
  "firstName" VARCHAR(150) NOT NULL DEFAULT '',
  "lastName" VARCHAR(150) NOT NULL DEFAULT '',
  "email" VARCHAR(254) NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
  "isStaff" BOOLEAN NOT NULL DEFAULT false,
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "dateJoined" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Session" (
  "tokenHash" VARCHAR(64) PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "expires" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "LoginAttempt" (
  "key" VARCHAR(64) PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "window" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "Career" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE "AcademicYear" (
  "id" SERIAL PRIMARY KEY,
  "year" INTEGER NOT NULL UNIQUE CHECK ("year" BETWEEN 2000 AND 2200)
);

CREATE TABLE "Module" (
  "id" SERIAL PRIMARY KEY,
  "yearId" INTEGER NOT NULL REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "number" SMALLINT NOT NULL CHECK ("number" BETWEEN 1 AND 4),
  "starts" DATE NOT NULL,
  "ends" DATE NOT NULL CHECK ("ends" >= "starts"),
  UNIQUE ("yearId",
  "number")
);

CREATE TABLE "Subject" (
  "id" SERIAL PRIMARY KEY,
  "careerId" INTEGER NOT NULL REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(150) NOT NULL,
  "level" SMALLINT NOT NULL CHECK ("level" BETWEEN 1 AND 3),
  "part" SMALLINT NOT NULL DEFAULT 1 CHECK ("part" BETWEEN 1 AND 2),
  UNIQUE ("careerId",
  "name",
  "part")
);

CREATE TABLE "Student" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "code" VARCHAR(30) NOT NULL UNIQUE,
  "entryYear" INTEGER NOT NULL CHECK ("entryYear" >= 0),
  "canViewGrades" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Enrollment" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "yearId" INTEGER NOT NULL REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "careerId" INTEGER NOT NULL REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "level" SMALLINT NOT NULL CHECK ("level" BETWEEN 1 AND 3),
  "shift" VARCHAR(1) NOT NULL CHECK ("shift" IN ('M','T','N')),
  UNIQUE ("studentId",
  "yearId",
  "careerId")
);

CREATE TABLE "Offering" (
  "id" SERIAL PRIMARY KEY,
  "subjectId" INTEGER NOT NULL REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "moduleId" INTEGER NOT NULL REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "teacherId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "shift" VARCHAR(1) NOT NULL CHECK ("shift" IN ('M','T','N')),
  UNIQUE ("subjectId",
  "moduleId",
  "shift")
);

CREATE TABLE "Registration" (
  "id" SERIAL PRIMARY KEY,
  "enrollmentId" INTEGER NOT NULL REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "offeringId" INTEGER NOT NULL REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "grade" DECIMAL(5,2),
  "published" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("enrollmentId",
  "offeringId"),
  CONSTRAINT "valid_grade" CHECK ("grade" IS NULL OR ("grade" >= 1 AND "grade" <= 100 AND "grade" != 'NaN'::numeric)),
  CONSTRAINT "published_has_grade" CHECK (NOT "published" OR "grade" IS NOT NULL)
);

CREATE TABLE "Extension" (
  "id" SERIAL PRIMARY KEY,
  "offeringId" INTEGER NOT NULL REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "until" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) > 0),
  "authorizedById" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditEvent" (
  "id" SERIAL PRIMARY KEY,
  "actorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" VARCHAR(100) NOT NULL,
  "details" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expires_idx" ON "Session" ("expires");
CREATE INDEX "Offering_teacherId_idx" ON "Offering" ("teacherId");
CREATE INDEX "Registration_offeringId_idx" ON "Registration" ("offeringId");
CREATE INDEX "Extension_offeringId_until_idx" ON "Extension" ("offeringId", "until");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent" ("createdAt");
