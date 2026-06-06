import { ListingRecord } from "./listing";

export type ReportStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
export type ReportTargetType = "LISTING" | "USER";

export interface ReportRecord {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolutionNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  targetType: ReportTargetType;
  reporter: {
    id: string;
    email: string;
    fullName: string | null;
  };
  reviewer: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  listing: (Pick<ListingRecord, "id" | "slug" | "title" | "status"> & {
    seller: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }) | null;
  reportedUser: {
    id: string;
    email: string;
    fullName: string | null;
    username: string | null;
    role: string;
    country: string | null;
    isVerified: boolean;
  } | null;
}

export interface ReportListResponse {
  data: ReportRecord[];
  meta: {
    total: number;
    openCount?: number;
    underReviewCount?: number;
  };
}
