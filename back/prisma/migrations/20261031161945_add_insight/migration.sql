-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GERAL',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "providerId" TEXT,
    "model" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Insight_tenantId_generatedAt_idx" ON "Insight"("tenantId", "generatedAt");

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
