export type Category = {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  parentId?: string;
  parent?: { id: string; name: string };
  iconName?: string;
  isActive: boolean;
};
