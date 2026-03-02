CREATE TYPE "EmployeeRoleProfile" AS ENUM ('ADMIN', 'MANAGER', 'RECEPTION', 'ACCOUNTANT', 'TECHNICIAN', 'EMPLOYEE');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE');

ALTER TABLE "User"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastLogoutAt" TIMESTAMP(3),
ADD COLUMN "lastLoginIp" TEXT,
ADD COLUMN "lastLoginUserAgent" TEXT,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Employee"
ADD COLUMN "roleProfile" "EmployeeRoleProfile" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "department" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "emergencyContact" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "permissionOverrides" JSONB,
ADD COLUMN "paymentFrequency" TEXT,
ADD COLUMN "bonusHistory" JSONB,
ADD COLUMN "deductions" JSONB,
ADD COLUMN "leaveBalance" JSONB,
ADD COLUMN "internalNotes" TEXT;
