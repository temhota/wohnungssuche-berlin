export type Listing = {
  id: string;
  provider: string;
  title: string;
  address: string;
  district: string | null;
  rooms: number;
  area: number;
  warmRent: number;
  wbs: string | null;
  features: string[];
  href: string;
  verified?: boolean;
};

export type ListingSource = {
  provider: string;
  status: "ok" | "error" | "loading";
  count: number;
  error?: string;
  fetchedAt?: string;
  stale?: boolean;
  provisional?: boolean;
  directFetchedAt?: string;
};

export type ListingResult = {
  listings: Listing[];
  sources: ListingSource[];
  fetchedAt: string;
};
