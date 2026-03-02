CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationType') THEN
    CREATE TYPE "ConversationType" AS ENUM ('SUPPORT', 'CENTER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationMessageType') THEN
    CREATE TYPE "ConversationMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'LINK');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ConversationType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
  "conversationId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId")
);

CREATE TABLE IF NOT EXISTS "ConversationMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" "ConversationMessageType" NOT NULL DEFAULT 'TEXT',
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationParticipant_conversationId_fkey'
      AND table_name = 'ConversationParticipant'
  ) THEN
    ALTER TABLE "ConversationParticipant"
      ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationParticipant_userId_fkey'
      AND table_name = 'ConversationParticipant'
  ) THEN
    ALTER TABLE "ConversationParticipant"
      ADD CONSTRAINT "ConversationParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationMessage_conversationId_fkey'
      AND table_name = 'ConversationMessage'
  ) THEN
    ALTER TABLE "ConversationMessage"
      ADD CONSTRAINT "ConversationMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationMessage_senderId_fkey'
      AND table_name = 'ConversationMessage'
  ) THEN
    ALTER TABLE "ConversationMessage"
      ADD CONSTRAINT "ConversationMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationMessage_deletedBy_fkey'
      AND table_name = 'ConversationMessage'
  ) THEN
    ALTER TABLE "ConversationMessage"
      ADD CONSTRAINT "ConversationMessage_deletedBy_fkey"
      FOREIGN KEY ("deletedBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_type_updatedAt_idx" ON "Conversation"("type", "updatedAt");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_idx" ON "ConversationMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_senderId_idx" ON "ConversationMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ConversationMessage_createdAt_idx" ON "ConversationMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_id_idx" ON "ConversationMessage"("conversationId", "createdAt", "id");
