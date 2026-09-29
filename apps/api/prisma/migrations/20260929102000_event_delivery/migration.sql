CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL,"type" TEXT NOT NULL,"aggregateId" TEXT NOT NULL,"payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"publishedAt" TIMESTAMP(3),"processedAt" TIMESTAMP(3),
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookEndpoint" (
  "id" TEXT NOT NULL,"userId" TEXT NOT NULL,"url" TEXT NOT NULL,"secret" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL,"eventId" TEXT NOT NULL,"endpointId" TEXT NOT NULL,"attempt" INTEGER NOT NULL,"statusCode" INTEGER NOT NULL,"success" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxEvent_publishedAt_createdAt_idx" ON "OutboxEvent"("publishedAt","createdAt");
CREATE INDEX "OutboxEvent_aggregateId_idx" ON "OutboxEvent"("aggregateId");
CREATE INDEX "WebhookEndpoint_userId_active_idx" ON "WebhookEndpoint"("userId","active");
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId","createdAt");
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
