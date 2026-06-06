export interface VerificationRecord {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    status: string;
    isVerified: boolean;
    platform: {
      name: string;
      slug: string;
    };
    media: Array<{
      id: string;
      type: string;
      fileUrl: string;
      sortOrder: number;
      createdAt: string;
    }>;
  };
  seller: {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string;
  };
}

export interface VerificationsResponse {
  data: VerificationRecord[];
  meta: {
    total: number;
    pendingCount: number;
  };
}
