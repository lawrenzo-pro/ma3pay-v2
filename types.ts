export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  PAYMENT = 'FARE_PAYMENT', // Mapped to backend enum
  TRANSFER_OUT = 'TRANSFER', // Mapped to backend enum (logic determines in/out)
  TRANSFER_IN = 'TRANSFER_IN', // UI only helper
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  route?: string;
  status: PaymentStatus;
}

export interface UserProfile {
  name: string;
  phoneNumber: string;
  balance: number;
  nfcTagId: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Route {
  id: string;
  name: string;
  standardPrice: number;
  peakPrice: number;
}

export interface AppRoute {
  id: string;
  name: string;
  origin: string;
  destination: string;
  fare: number;
  status: string;
  matatus: Array<{
    id: string;
    plateNumber: string;
    status: string;
  }>;
}

export interface AppDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
  assignedMatatus: Array<{
    id: string;
    plateNumber: string;
    status: string;
    RouteId?: string;
  }>;
}

export interface AppMatatu {
  id: string;
  plateNumber: string;
  sacco: string;
  status: string;
  route: {
    id: string;
    name: string;
    origin: string;
    destination: string;
    fare: number;
    status: string;
  } | null;
  driver: {
    id: string;
    name: string;
    phone: string;
    status: string;
  } | null;
  averageRating: number | null;
  reviewCount: number;
}

export interface AppMatatuRatingsResponse {
  matatu: {
    id: string;
    plateNumber: string;
  };
  averageRating: number | null;
  reviewCount: number;
  ratings: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    User?: {
      id: string;
      name: string;
    };
  }>;
}

export interface AppRide {
  id: string;
  amount: number;
  reference?: string;
  description: string;
  date: string;
  matatu: {
    id: string;
    plateNumber: string;
    sacco: string;
    route: {
      id: string;
      name: string;
      origin: string;
      destination: string;
      fare: number;
      status: string;
    } | null;
    driver: {
      id: string;
      name: string;
      phone: string;
      status: string;
    } | null;
  } | null;
}

export interface AppRidesResponse {
  count: number;
  rides: AppRide[];
}

export interface AppFarePaymentResponse {
  message: string;
  plateNumber: string;
  route?: string;
  amount: number;
  recipient?: {
    adminPhone: string;
    adminName: string;
  };
  balances?: {
    payer: number | null;
    recipient: number | null;
  };
}

export type Language = 'en' | 'sw';

// API Responses
export interface AuthResponse {
    message: string;
    token: string;
    user: {
        name: string;
        balance: number;
    }
}
