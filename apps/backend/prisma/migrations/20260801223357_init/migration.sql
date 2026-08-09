-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('CREDIT_CARD', 'CUSTOMER_CLUB', 'EMPLOYEE_CLUB', 'RETAILER_CLUB', 'OTHER');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'CASHBACK', 'POINTS', 'GIFT', 'TWO_FOR_ONE', 'FREE_SHIPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountUnit" AS ENUM ('PERCENT', 'ILS', 'POINTS');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('ONLINE', 'IN_STORE', 'BOTH');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('SINGLE_USE_SHARED', 'UNIQUE_PER_USER');

-- CreateEnum
CREATE TYPE "MediaEntityType" AS ENUM ('BRAND', 'PROGRAM', 'BENEFIT', 'CAMPAIGN', 'STORE');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('LOGO', 'COVER', 'GALLERY', 'ICON');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE');

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('ENDING_SOON', 'NEW_BENEFIT', 'PRICE_DROP');

-- CreateEnum
CREATE TYPE "ScraperSourceType" AS ENUM ('ISSUER_SITE', 'BRAND_SITE', 'AGGREGATOR_SITE');

-- CreateEnum
CREATE TYPE "ScraperRenderMode" AS ENUM ('HTTP', 'HEADLESS_BROWSER');

-- CreateEnum
CREATE TYPE "TosReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScraperRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ScrapedItemStatus" AS ENUM ('AUTO_PUBLISHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "issuers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "websiteUrl" TEXT,
    "supportPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "parentProgramId" TEXT,
    "path" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" "ProgramType" NOT NULL,
    "logoUrl" TEXT,
    "cardImageUrl" TEXT,
    "color" TEXT,
    "description" TEXT,
    "joinUrl" TEXT,
    "termsUrl" TEXT,
    "annualFee" DECIMAL(10,2),
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "iconName" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "parentBrandId" TEXT,
    "categoryId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "websiteUrl" TEXT,
    "onlineShopUrl" TEXT,
    "description" TEXT,
    "hasOnlineStore" BOOLEAN NOT NULL DEFAULT false,
    "hasPhysicalStores" BOOLEAN NOT NULL DEFAULT false,
    "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "cityId" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "phone" TEXT,
    "openingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "fullDescription" TEXT,
    "categoryId" TEXT NOT NULL,
    "benefitType" "BenefitType" NOT NULL,
    "discountValue" DECIMAL(10,2),
    "discountUnit" "DiscountUnit",
    "minPurchaseAmount" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "valueScore" INTEGER NOT NULL DEFAULT 0,
    "requiresCoupon" BOOLEAN NOT NULL DEFAULT false,
    "channel" "Channel" NOT NULL DEFAULT 'BOTH',
    "termsAndConditions" TEXT,
    "externalUrl" TEXT,
    "imageUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "sourceMetadata" JSONB,
    "lastScrapedItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_scopes" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "programId" TEXT,
    "brandId" TEXT,
    "storeId" TEXT,
    "cityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'SINGLE_USE_SHARED',
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerImageUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_benefits" (
    "campaignId" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_benefits_pkey" PRIMARY KEY ("campaignId","benefitId")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_tags" (
    "benefitId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "benefit_tags_pkey" PRIMARY KEY ("benefitId","tagId")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "entityType" "MediaEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "assetType" "MediaAssetType" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changedFields" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedBenefitId" TEXT,
    "triggerType" "NotificationTrigger" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "ScraperSourceType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "renderMode" "ScraperRenderMode" NOT NULL DEFAULT 'HTTP',
    "scrapeConfig" JSONB NOT NULL,
    "defaultProgramId" TEXT,
    "defaultBrandId" TEXT,
    "requestDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "scheduleCron" TEXT NOT NULL DEFAULT '0 3 * * *',
    "tosStatus" "TosReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "tosReviewedBy" TEXT,
    "tosReviewedAt" TIMESTAMP(3),
    "tosNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" "ScraperRunStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "scraper_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ScraperRunStatus" NOT NULL DEFAULT 'PARTIAL',
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsFlagged" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "scraper_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraped_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "matchedBenefitId" TEXT,
    "confidenceScore" INTEGER NOT NULL,
    "confidenceReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ScrapedItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraped_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuers_slug_key" ON "issuers"("slug");

-- CreateIndex
CREATE INDEX "issuers_isActive_sortOrder_idx" ON "issuers"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE INDEX "programs_issuerId_idx" ON "programs"("issuerId");

-- CreateIndex
CREATE INDEX "programs_type_isActive_idx" ON "programs"("type", "isActive");

-- CreateIndex
CREATE INDEX "programs_path_idx" ON "programs"("path");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_categoryId_idx" ON "brands"("categoryId");

-- CreateIndex
CREATE INDEX "stores_brandId_idx" ON "stores"("brandId");

-- CreateIndex
CREATE INDEX "stores_cityId_idx" ON "stores"("cityId");

-- CreateIndex
CREATE INDEX "stores_lat_lng_idx" ON "stores"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "benefits_slug_key" ON "benefits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "benefits_lastScrapedItemId_key" ON "benefits"("lastScrapedItemId");

-- CreateIndex
CREATE INDEX "benefits_categoryId_idx" ON "benefits"("categoryId");

-- CreateIndex
CREATE INDEX "benefits_isActive_startDate_endDate_idx" ON "benefits"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "benefits_isPopular_priority_idx" ON "benefits"("isPopular", "priority");

-- CreateIndex
CREATE INDEX "benefit_scopes_programId_brandId_idx" ON "benefit_scopes"("programId", "brandId");

-- CreateIndex
CREATE INDEX "benefit_scopes_programId_storeId_idx" ON "benefit_scopes"("programId", "storeId");

-- CreateIndex
CREATE INDEX "benefit_scopes_brandId_idx" ON "benefit_scopes"("brandId");

-- CreateIndex
CREATE INDEX "benefit_scopes_benefitId_idx" ON "benefit_scopes"("benefitId");

-- CreateIndex
CREATE INDEX "coupons_benefitId_idx" ON "coupons"("benefitId");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "benefit_tags_tagId_benefitId_idx" ON "benefit_tags"("tagId", "benefitId");

-- CreateIndex
CREATE INDEX "media_assets_entityType_entityId_idx" ON "media_assets"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "scraper_sources_slug_key" ON "scraper_sources"("slug");

-- CreateIndex
CREATE INDEX "scraper_sources_isActive_tosStatus_idx" ON "scraper_sources"("isActive", "tosStatus");

-- CreateIndex
CREATE INDEX "scraper_runs_sourceId_startedAt_idx" ON "scraper_runs"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "scraped_items_status_idx" ON "scraped_items"("status");

-- CreateIndex
CREATE INDEX "scraped_items_matchedBenefitId_idx" ON "scraped_items"("matchedBenefitId");

-- CreateIndex
CREATE UNIQUE INDEX "scraped_items_sourceId_externalId_key" ON "scraped_items"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_parentProgramId_fkey" FOREIGN KEY ("parentProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_parentBrandId_fkey" FOREIGN KEY ("parentBrandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_lastScrapedItemId_fkey" FOREIGN KEY ("lastScrapedItemId") REFERENCES "scraped_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_scopes" ADD CONSTRAINT "benefit_scopes_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_scopes" ADD CONSTRAINT "benefit_scopes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_scopes" ADD CONSTRAINT "benefit_scopes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_scopes" ADD CONSTRAINT "benefit_scopes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_scopes" ADD CONSTRAINT "benefit_scopes_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_benefits" ADD CONSTRAINT "campaign_benefits_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_benefits" ADD CONSTRAINT "campaign_benefits_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_tags" ADD CONSTRAINT "benefit_tags_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_tags" ADD CONSTRAINT "benefit_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_relatedBenefitId_fkey" FOREIGN KEY ("relatedBenefitId") REFERENCES "benefits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_sources" ADD CONSTRAINT "scraper_sources_defaultProgramId_fkey" FOREIGN KEY ("defaultProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_sources" ADD CONSTRAINT "scraper_sources_defaultBrandId_fkey" FOREIGN KEY ("defaultBrandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraper_runs" ADD CONSTRAINT "scraper_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "scraper_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "scraper_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_runId_fkey" FOREIGN KEY ("runId") REFERENCES "scraper_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_matchedBenefitId_fkey" FOREIGN KEY ("matchedBenefitId") REFERENCES "benefits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
