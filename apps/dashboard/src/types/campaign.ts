export type Campaign = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  benefits: { benefit: { id: string; title: string } }[];
};
