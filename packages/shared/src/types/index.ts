// Enums
export type TicketStatus = 'OWNED' | 'LISTED' | 'SCANNED' | 'VOID' | 'TRANSFERRED';
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod =
  | 'BRAINTREE_CARD'
  | 'BRAINTREE_APPLE_PAY'
  | 'BRAINTREE_GOOGLE_PAY'
  | 'USDC_POLYGON';
export type UserRole = 'USER' | 'ORGANIZER' | 'SCANNER' | 'ADMIN';
export type OrganizerStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';
export type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

// API response shapes
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress: string;
  avatarUrl: string | null;
}

export interface ApiOrganizer {
  id: string;
  orgName: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: OrganizerStatus;
  userId: string;
  createdAt: string;
}

export interface ApiTicketTier {
  id: string;
  name: string;
  description: string | null;
  faceValueCents: number;
  totalSupply: number;
  remainingSupply: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
}

export interface ApiEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  startsAt: string;
  endsAt: string;
  imageUrl: string | null;
  isPublished: boolean;
  isCancelled: boolean;
  organizer: { id: string; orgName: string; logoUrl: string | null };
  tiers: ApiTicketTier[];
}

export interface ApiTicket {
  id: string;
  tokenId: string;
  status: TicketStatus;
  mintTxHash: string | null;
  createdAt: string;
  tier: ApiTicketTier;
  event: Pick<ApiEvent, 'id' | 'title' | 'slug' | 'venue' | 'city' | 'startsAt' | 'imageUrl'>;
  listing: ApiListing | null;
}

export interface ApiListing {
  id: string;
  ticketId: string;
  askPriceCents: number;
  status: ListingStatus;
  createdAt: string;
  seller: { id: string; name: string };
  ticket?: ApiTicket;
}

export interface ApiOrder {
  id: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  ticket: ApiTicket;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

export interface UsdcPaymentSession {
  id: string;
  toAddress: string;
  expectedUsdc: string;
  amountCents: number;
  fulfilled: boolean;
  expiresAt: string;
}

export interface PlatformSettings {
  resaleMarkupMaxBps: number;
  platformFeeBps: number;
  maintenanceMode: boolean;
}

export interface ScanResult {
  success: boolean;
  reason?: 'ALREADY_SCANNED' | 'INVALID_TOKEN' | 'WRONG_EVENT' | 'EXPIRED' | 'TICKET_VOID';
  ticket?: {
    holderName: string;
    tierName: string;
    eventTitle: string;
  };
}

// Request body types
export interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface CreateEventBody {
  title: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  startsAt: string;
  endsAt: string;
}

export interface CreateTierBody {
  name: string;
  description?: string;
  faceValueCents: number;
  totalSupply: number;
  salesStartAt?: string;
  salesEndAt?: string;
}

export interface CreateListingBody {
  ticketId: string;
  askPriceCents: number;
}

export interface BraintreeCheckoutBody {
  nonce: string;
  tierId: string;
}

export interface BuyListingBody {
  nonce: string;
}
