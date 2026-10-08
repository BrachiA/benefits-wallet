-- CreateEnum
CREATE TYPE "LogoMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "benefits" ADD COLUMN     "r2ImageUrl" TEXT;

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "defaultLogoUrl" TEXT,
ADD COLUMN     "logoMode" "LogoMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "logoSearchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "defaultLogoUrl" TEXT,
ADD COLUMN     "logoMode" "LogoMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "logoSearchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "scraped_items" ADD COLUMN     "r2ImageUrl" TEXT;
