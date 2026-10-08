-- DropIndex
DROP INDEX "benefits_short_desc_trgm_idx";

-- DropIndex
DROP INDEX "benefits_title_trgm_idx";

-- DropIndex
DROP INDEX "brands_name_en_trgm_idx";

-- DropIndex
DROP INDEX "brands_name_trgm_idx";

-- DropIndex
DROP INDEX "categories_name_en_trgm_idx";

-- DropIndex
DROP INDEX "categories_name_trgm_idx";

-- DropIndex
DROP INDEX "programs_name_trgm_idx";

-- DropIndex
DROP INDEX "stores_name_trgm_idx";

-- CreateTable
CREATE TABLE "alert_settings" (
    "id" TEXT NOT NULL,
    "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_settings_pkey" PRIMARY KEY ("id")
);
