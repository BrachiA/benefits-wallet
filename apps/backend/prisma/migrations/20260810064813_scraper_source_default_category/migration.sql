-- AlterTable
ALTER TABLE "scraper_sources" ADD COLUMN     "defaultCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "scraper_sources" ADD CONSTRAINT "scraper_sources_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
