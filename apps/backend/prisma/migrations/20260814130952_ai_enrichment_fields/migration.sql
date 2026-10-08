-- AlterTable
ALTER TABLE "scraped_items" ADD COLUMN     "aiCategorySuggestedAt" TIMESTAMP(3),
ADD COLUMN     "aiImageCheckedAt" TIMESTAMP(3),
ADD COLUMN     "aiSuggestedCategoryId" TEXT,
ADD COLUMN     "aiSummary" TEXT;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_aiSuggestedCategoryId_fkey" FOREIGN KEY ("aiSuggestedCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
