export interface ListingSummary {
  id: string;
  title: string;
  slug: string;
  platform: string;
  price: number;
  followersCount?: number;
  engagementRate?: number;
  isVerified: boolean;
}

