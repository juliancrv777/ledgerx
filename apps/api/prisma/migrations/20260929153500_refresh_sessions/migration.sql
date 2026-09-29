CREATE TABLE "RefreshSession" (
  "id" TEXT NOT NULL,"userId" TEXT NOT NULL,"tokenHash" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"revokedAt" TIMESTAMP(3),CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId","expiresAt");
