-- Add direct conversation uniqueness key for chat threads
ALTER TABLE "ChatThread"
ADD COLUMN "directKey" TEXT;

CREATE UNIQUE INDEX "ChatThread_directKey_key" ON "ChatThread"("directKey");