export type ScrapedItem = {
  id: string;
  sourceId: string;
  source?: { name: string };
  externalId: string;
  rawData: {
    title: string;
    shortDescription?: string;
    discountValue?: number;
    imageUrl?: string;
    detailUrl?: string;
  };
  matchedBenefitId?: string;
  matchedBenefit?: { id: string; title: string };
  confidenceScore: number;
  confidenceReasons: string[];
  status: 'AUTO_PUBLISHED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  scrapedAt: string;
};
