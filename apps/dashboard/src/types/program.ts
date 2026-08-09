export type Issuer = { id: string; name: string };

export type Program = {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  type: string;
  issuerId: string;
  issuer?: Issuer;
  parentProgramId?: string;
  parentProgram?: { id: string; name: string };
  annualFee?: number;
  isActive: boolean;
  isPopular: boolean;
};

export const programTypeLabels: Record<string, string> = {
  CREDIT_CARD: 'כרטיס אשראי',
  CUSTOMER_CLUB: 'מועדון לקוחות',
  EMPLOYEE_CLUB: 'מועדון עובדים',
  RETAILER_CLUB: 'מועדון רשת',
  OTHER: 'אחר',
};
