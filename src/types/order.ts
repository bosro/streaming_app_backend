import { OrderStatus } from '@prisma/client';

export interface CreateOrderRequest {
  items: OrderItemRequest[];
  shippingAddress?: ShippingAddress;
  billingAddress?: BillingAddress;
  couponCode?: string;
  notes?: string;
}

export interface OrderItemRequest {
  productId: string;
  quantity: number;
  customizations?: Record<string, string>;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BillingAddress extends ShippingAddress {}

export interface OrderFilters {
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}