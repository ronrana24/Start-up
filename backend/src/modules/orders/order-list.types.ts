import type { OrderListPeriod } from './dto/list-orders-query.dto';

/** Line-item display status derived from the parent order status. */
export type OrderItemLineStatus = 'delivered' | 'processing' | 'other';

export type OrderListItemLine = {
  productId: string;
  name: string;
  quantity: number;
  priceApplied: string;
  status: OrderItemLineStatus;
};

export type OrderListEntry = {
  orderId: string;
  orderAmount: string;
  orderDate: string;
  items: OrderListItemLine[];
};

export type UserOrdersListResponse = {
  filter: OrderListPeriod;
  totalOrders: number;
  totalSpending: string;
  orders: OrderListEntry[];
};
