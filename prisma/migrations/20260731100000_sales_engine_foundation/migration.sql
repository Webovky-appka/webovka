-- CreateEnum
CREATE TYPE "SalesCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SalesLeadStatus" AS ENUM ('DISCOVERED', 'QUALIFYING', 'QUALIFIED', 'RESEARCHING', 'DESIGNING', 'READY_FOR_REVIEW', 'APPROVED', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SalesEmailStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'REJECTED');

-- CreateTable
CREATE TABLE "SalesCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "segment" TEXT,
    "geography" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 8,
    "minScore" INTEGER NOT NULL DEFAULT 60,
    "status" "SalesCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "SalesLeadStatus" NOT NULL DEFAULT 'DISCOVERED',
    "score" INTEGER,
    "businessScore" INTEGER,
    "websiteScore" INTEGER,
    "opportunityGap" INTEGER,
    "reason" TEXT,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesContact" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAudit" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "visualScore" INTEGER,
    "uxScore" INTEGER,
    "mobileScore" INTEGER,
    "conversionScore" INTEGER,
    "seoScore" INTEGER,
    "performanceScore" INTEGER,
    "findings" JSONB,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesEmailDraft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "strategy" TEXT,
    "promptVersionId" TEXT,
    "status" "SalesEmailStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "SalesEmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesActivity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "leadId" TEXT,
    "actor" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "SalesRunStatus" NOT NULL DEFAULT 'QUEUED',
    "stats" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "runId" TEXT,
    "campaignId" TEXT,
    "leadId" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "summary" TEXT,
    "model" TEXT,
    "promptVersionId" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPromptVersion" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "system" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_domain_key" ON "Prospect"("domain");

-- CreateIndex
CREATE INDEX "SalesLead_campaignId_status_idx" ON "SalesLead"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SalesLead_status_idx" ON "SalesLead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_prospectId_campaignId_key" ON "SalesLead"("prospectId", "campaignId");

-- CreateIndex
CREATE INDEX "SalesContact_prospectId_idx" ON "SalesContact"("prospectId");

-- CreateIndex
CREATE INDEX "SalesAudit_leadId_idx" ON "SalesAudit"("leadId");

-- CreateIndex
CREATE INDEX "SalesEmailDraft_leadId_idx" ON "SalesEmailDraft"("leadId");

-- CreateIndex
CREATE INDEX "SalesEmailDraft_status_idx" ON "SalesEmailDraft"("status");

-- CreateIndex
CREATE INDEX "SalesActivity_prospectId_createdAt_idx" ON "SalesActivity"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesActivity_leadId_createdAt_idx" ON "SalesActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesRun_campaignId_createdAt_idx" ON "SalesRun"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_agent_startedAt_idx" ON "AgentRun"("agent", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_runId_idx" ON "AgentRun"("runId");

-- CreateIndex
CREATE INDEX "AgentRun_leadId_idx" ON "AgentRun"("leadId");

-- CreateIndex
CREATE INDEX "SalesPromptVersion_agent_active_idx" ON "SalesPromptVersion"("agent", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPromptVersion_agent_version_key" ON "SalesPromptVersion"("agent", "version");

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SalesCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesContact" ADD CONSTRAINT "SalesContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAudit" ADD CONSTRAINT "SalesAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEmailDraft" ADD CONSTRAINT "SalesEmailDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEmailDraft" ADD CONSTRAINT "SalesEmailDraft_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "SalesPromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEmailDraft" ADD CONSTRAINT "SalesEmailDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesActivity" ADD CONSTRAINT "SalesActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRun" ADD CONSTRAINT "SalesRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SalesCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SalesRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SalesCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "SalesPromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPromptVersion" ADD CONSTRAINT "SalesPromptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

