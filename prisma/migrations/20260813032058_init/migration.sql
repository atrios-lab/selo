-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendingDomain" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sesTenantName" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "dkimTokens" TEXT[],
    "mailFromDomain" TEXT,
    "fallbackOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "SendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sendingDomainId" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "tag" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "sesMessageId" TEXT,
    "status" "EmailStatus" NOT NULL,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressedAddress" (
    "id" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_apiKeyHash_key" ON "Product"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "SendingDomain_domain_key" ON "SendingDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SendingDomain_sesTenantName_key" ON "SendingDomain"("sesTenantName");

-- CreateIndex
CREATE INDEX "SendingDomain_status_idx" ON "SendingDomain"("status");

-- CreateIndex
CREATE INDEX "EmailLog_sesMessageId_idx" ON "EmailLog"("sesMessageId");

-- CreateIndex
CREATE INDEX "EmailLog_to_idx" ON "EmailLog"("to");

-- CreateIndex
CREATE INDEX "EmailLog_tag_idx" ON "EmailLog"("tag");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_productId_idempotencyKey_key" ON "EmailLog"("productId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SuppressedAddress_address_idx" ON "SuppressedAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressedAddress_sendingDomainId_address_key" ON "SuppressedAddress"("sendingDomainId", "address");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressedAddress" ADD CONSTRAINT "SuppressedAddress_sendingDomainId_fkey" FOREIGN KEY ("sendingDomainId") REFERENCES "SendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
