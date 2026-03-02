export type ProductCheckResult = {
  inStock: boolean;
  price?: number | null;
  source?: 'http' | 'browser';
  size?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
};

export interface StoreScraper {
  name: string;
  checkProduct: (args: { url: string; selector?: string | null; size?: string | null }) => Promise<ProductCheckResult>;
}



