import { Injectable } from '@nestjs/common';
import type { Order, Rider } from '@prisma/client';
import { DeliveryGateway } from './delivery.gateway';

type DeliveryOrderPayload = Order & {
  rider?: Rider | null;
};

@Injectable()
export class DeliveryEventsService {
  constructor(private readonly gateway: DeliveryGateway) {}

  orderCreated(order: unknown) {
    this.gateway.emitToRooms(
      ['available-riders', 'admin'],
      'order.created',
      order,
    );
    this.gateway.emitToRooms(['available-riders'], 'available-orders.changed', {
      reason: 'order_created',
    });
  }

  orderAvailable(order: unknown) {
    this.gateway.emitToRooms(
      ['available-riders', 'admin'],
      'order.available',
      order,
    );
    this.gateway.emitToRooms(['available-riders'], 'available-orders.changed', {
      reason: 'order_available',
    });
  }

  orderAssigned(order: DeliveryOrderPayload) {
    const rooms = this.orderRooms(order);
    this.gateway.emitToRooms(rooms, 'order.assigned', order);
    this.gateway.emitToRooms(rooms, 'order.updated', order);
    this.gateway.emitToRooms(['available-riders'], 'available-orders.changed', {
      reason: 'order_assigned',
      orderId: order.id,
    });
  }

  orderStatusChanged(order: DeliveryOrderPayload) {
    this.gateway.emitToRooms(this.orderRooms(order), 'order.status_changed', {
      orderId: order.id,
      status: order.status,
      order,
    });
    this.gateway.emitToRooms(this.orderRooms(order), 'order.updated', order);
  }

  riderLocationUpdated(input: {
    riderId: string;
    orderId?: string;
    orderIds?: string[];
    location: { lat: number; lng: number; heading?: number | null };
    order?: DeliveryOrderPayload;
    orders?: DeliveryOrderPayload[];
  }) {
    const orderIds = input.orderIds ?? (input.orderId ? [input.orderId] : []);
    this.gateway.emitToRooms(
      ['admin', `rider:${input.riderId}`],
      'rider.location_updated',
      {
        riderId: input.riderId,
        orderIds,
        location: input.location,
      },
    );
    for (const orderId of orderIds) {
      this.gateway.emitToRooms([`order:${orderId}`], 'rider.location_updated', {
        riderId: input.riderId,
        orderId,
        orderIds: [orderId],
        location: input.location,
      });
    }
  }

  riderAvailabilityChanged(input: {
    riderId: string;
    available: boolean;
    reason: string;
    /**
     * The rider's shift toggle (rider-owned), distinct from `available` which
     * reflects offer-eligibility (`isAvailable && status === IDLE`) and drives
     * room membership. Only set when the toggle itself changed, so other events
     * (claim/terminal/reassign) leave the client's known toggle state intact.
     */
    isAvailable?: boolean;
  }) {
    this.gateway.setRiderAvailableRoom(input.riderId, input.available);
    this.gateway.emitToRooms(
      ['admin', `rider:${input.riderId}`],
      'rider.availability_changed',
      {
        riderId: input.riderId,
        available: input.available,
        ...(input.isAvailable !== undefined
          ? { isAvailable: input.isAvailable }
          : {}),
        reason: input.reason,
        at: new Date().toISOString(),
      },
    );
    this.gateway.emitToRooms(['available-riders'], 'available-orders.changed', {
      reason: input.reason,
    });
  }

  private orderRooms(order: DeliveryOrderPayload): string[] {
    const rooms = ['admin', `order:${order.id}`];
    if (order.riderId) {
      rooms.push(`rider:${order.riderId}`);
    }
    return rooms;
  }
}
