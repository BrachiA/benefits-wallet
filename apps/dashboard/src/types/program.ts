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
  // לוגו ברירת מחדל (Cloudflare R2) — נמצא אוטומטית ע"י AI (Grounding
  // with Google Search) או הועלה ידנית. ראו components/LogoModeField.
  defaultLogoUrl?: string | null;
  logoMode: 'AUTO' | 'MANUAL';
};

export const programTypeLabels: Record<string, string> = {
  CREDIT_CARD: 'כרטיס אשראי',
  CUSTOMER_CLUB: 'מועדון לקוחות',
  EMPLOYEE_CLUB: 'מועדון עובדים',
  RETAILER_CLUB: 'מועדון רשת',
  OTHER: 'אחר',
};
