// User roles
export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  WAITER = "WAITER",
  KITCHEN = "KITCHEN",
  CASHIER = "CASHIER",
}

// Table status
export enum TableStatus {
  FREE = "FREE",
  OCCUPIED = "OCCUPIED",
  RESERVED = "RESERVED",
  BILL_REQUESTED = "BILL_REQUESTED",
}

// Table shape
export enum TableShape {
  SQUARE = "SQUARE",
  ROUND = "ROUND",
  RECTANGLE = "RECTANGLE",
}

// Reservation status
export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  ARRIVED = "ARRIVED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

// Order status
export enum OrderStatus {
  OPEN = "OPEN",
  IN_KITCHEN = "IN_KITCHEN",
  READY = "READY",
  BILL = "BILL",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

// Order item status
export enum OrderItemStatus {
  PENDING = "PENDING",
  COOKING = "COOKING",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

// Payment method
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  QR = "QR",
  MIXED = "MIXED",
}

// Discount type
export enum DiscountType {
  PERCENT = "PERCENT",
  FIXED = "FIXED",
}

// Subscription plan
export enum SubscriptionPlan {
  FREE = "FREE",
  BASIC = "BASIC",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
}

// Auth types
export type SuperAdminToken = {
  role: "SUPERADMIN";
  superAdminId: string;
  iat: number;
  exp: number;
};

export type UserToken = {
  role: UserRole;
  userId: string;
  restaurantId: string;
  iat: number;
  exp: number;
};

export type JWTPayload = SuperAdminToken | UserToken;

// Request types
export type LoginRequest = {
  restaurantId: string;
  pin: string;
};

export type SuperAdminLoginRequest = {
  email: string;
  password: string;
};

// API Response types
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  limit: number;
}>;
