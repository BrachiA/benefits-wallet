export type Coupon = {
  id: string;
  benefitId: string;
  benefit?: { title: string };
  code: string;
  type: 'SINGLE_USE_SHARED' | 'UNIQUE_PER_USER';
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  isActive: boolean;
};
