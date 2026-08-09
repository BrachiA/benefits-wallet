-- AlterEnum
ALTER TYPE "ScrapedItemStatus" ADD VALUE 'SUPERSEDED';

-- DropIndex
DROP INDEX "scraped_items_sourceId_externalId_key";

-- CreateIndex
CREATE INDEX "scraped_items_sourceId_externalId_scrapedAt_idx" ON "scraped_items"("sourceId", "externalId", "scrapedAt");
