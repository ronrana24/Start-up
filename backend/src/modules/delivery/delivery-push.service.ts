import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import type { App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';

type PushOrder = {
  id: string;
  deliveryFee: Prisma.Decimal | string | number;
  addressSnapshot?: Prisma.JsonValue | null;
  createdAt: Date | string;
};

type PushPayload = {
  orderId: string;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedPayout: string;
  deliveryDistance: string;
  orderCreatedAt: string;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, string>;
  priority: 'high';
  channelId: 'orders';
};

const FCM_BATCH_SIZE = 500;

@Injectable()
export class DeliveryPushService {
  private readonly logger = new Logger(DeliveryPushService.name);
  private firebaseApp: App | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async notifyAvailableRiders(order: PushOrder) {
    const devices = await this.prisma.riderDevice.findMany({
      where: {
        isActive: true,
      },
      select: { pushToken: true, platform: true },
    });

    const tokens = [...new Set(devices.map((device) => device.pushToken))];
    if (!tokens.length) {
      return;
    }

    const payload = this.buildPayload(order);
    const fcmTokens = tokens.filter((token) => !this.isExpoToken(token));
    const expoTokens = tokens.filter((token) => this.isExpoToken(token));

    if (fcmTokens.length) {
      await this.sendFcmPush(fcmTokens, payload);
    }
    if (expoTokens.length) {
      await this.sendExpoPush(expoTokens, payload);
    }
  }

  private buildPayload(order: PushOrder): PushPayload {
    const deliveryAddress = this.deliveryLocationLabel(order.addressSnapshot);
    const estimatedPayout = Number(order.deliveryFee).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
    return {
      orderId: order.id,
      pickupAddress: this.config.get<string>('delivery.pickupLabel') ?? '',
      deliveryAddress,
      estimatedPayout,
      deliveryDistance: this.deliveryDistanceLabel(order.addressSnapshot),
      orderCreatedAt:
        order.createdAt instanceof Date
          ? order.createdAt.toISOString()
          : new Date(order.createdAt).toISOString(),
    };
  }

  private async sendFcmPush(tokens: string[], payload: PushPayload) {
    const messaging = this.messaging();
    if (!messaging) {
      return;
    }

    for (let index = 0; index < tokens.length; index += FCM_BATCH_SIZE) {
      const batch = tokens.slice(index, index + FCM_BATCH_SIZE);
      try {
        const res = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: {
            title: 'New delivery available',
            body: `Order ${payload.orderId.slice(0, 8)} - ${payload.deliveryAddress} - ${payload.estimatedPayout}`,
          },
          data: {
            type: 'order_available',
            orderId: payload.orderId,
            pickupAddress: payload.pickupAddress,
            deliveryAddress: payload.deliveryAddress,
            estimatedPayout: payload.estimatedPayout,
            deliveryDistance: payload.deliveryDistance,
            orderCreatedAt: payload.orderCreatedAt,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'orders',
              sound: 'default',
              clickAction: 'OPEN_ORDER',
            },
          },
        });

        const invalidTokens = res.responses
          .map((response, responseIndex) => ({
            ok: response.success,
            code: response.error?.code,
            token: batch[responseIndex],
          }))
          .filter((result) => this.isInvalidFcmToken(result.code))
          .map((result) => result.token);

        if (invalidTokens.length) {
          await this.deactivateTokens(invalidTokens);
        }
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? `FCM push request failed: ${error.message}`
            : 'FCM push request failed',
        );
      }
    }
  }

  private async sendExpoPush(tokens: string[], payload: PushPayload) {
    if (!this.config.get<boolean>('delivery.expoPush.enabled')) {
      return;
    }

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: 'default',
      title: 'New delivery available',
      body: `Order ${payload.orderId.slice(0, 8)} - ${payload.deliveryAddress} - ${payload.estimatedPayout}`,
      data: {
        type: 'order_available',
        orderId: payload.orderId,
        pickupAddress: payload.pickupAddress,
        deliveryAddress: payload.deliveryAddress,
        estimatedPayout: payload.estimatedPayout,
        deliveryDistance: payload.deliveryDistance,
        orderCreatedAt: payload.orderCreatedAt,
      },
      priority: 'high',
      channelId: 'orders',
    }));

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      };
      const accessToken = this.config.get<string>(
        'delivery.expoPush.accessToken',
      );
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        this.logger.warn(`Expo push request failed with status ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Expo push request failed: ${error.message}`
          : 'Expo push request failed',
      );
    }
  }

  private messaging(): Messaging | null {
    if (!this.config.get<boolean>('delivery.fcmPush.enabled')) {
      return null;
    }

    const app = this.firebase();
    return app ? getMessaging(app) : null;
  }

  private firebase(): App | null {
    if (this.firebaseApp !== undefined) {
      return this.firebaseApp;
    }

    const serviceAccountJson = this.config.get<string>(
      'delivery.firebase.serviceAccountJson',
    );
    const projectId = this.config.get<string>('delivery.firebase.projectId');

    try {
      if (getApps().length) {
        this.firebaseApp = getApps()[0];
        return this.firebaseApp;
      }

      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
        this.firebaseApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId ?? projectId,
        });
        return this.firebaseApp;
      }

      if (projectId) {
        this.firebaseApp = initializeApp({
          credential: applicationDefault(),
          projectId,
        });
        return this.firebaseApp;
      }
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Firebase push initialization failed: ${error.message}`
          : 'Firebase push initialization failed',
      );
    }

    this.firebaseApp = null;
    this.logger.warn(
      'FCM push skipped; Firebase credentials are not configured',
    );
    return null;
  }

  private async deactivateTokens(tokens: string[]) {
    await this.prisma.riderDevice.updateMany({
      where: { pushToken: { in: tokens } },
      data: { isActive: false },
    });
  }

  private isExpoToken(token: string) {
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[')
    );
  }

  private isInvalidFcmToken(code: string | undefined) {
    return (
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-argument'
    );
  }

  private deliveryLocationLabel(value: Prisma.JsonValue | null | undefined) {
    const record = this.recordFromJson(value);
    if (!record) {
      return 'Delivery address';
    }
    const parts = [record.line1, record.city, record.state, record.pincode]
      .filter((part): part is string => typeof part === 'string' && !!part)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : 'Delivery address';
  }

  private deliveryDistanceLabel(value: Prisma.JsonValue | null | undefined) {
    const pickup = this.config.get<{ lat: number; lng: number } | null>(
      'delivery.pickupCoordinates',
    );
    const delivery = this.coordinatesFromJson(value);
    if (!pickup || !delivery) {
      return '';
    }
    const km = this.haversineKm(pickup, delivery) * 1.28;
    return `${km.toFixed(km < 10 ? 1 : 0)} km`;
  }

  private coordinatesFromJson(value: Prisma.JsonValue | null | undefined) {
    const record = this.recordFromJson(value);
    const coordinates = this.recordFromJson(record?.coordinates);
    const source = coordinates ?? record;
    if (!source) {
      return null;
    }

    const rawLat = source.lat ?? source.latitude;
    const rawLng = source.lng ?? source.longitude;
    const lat = typeof rawLat === 'string' ? Number(rawLat) : rawLat;
    const lng = typeof rawLng === 'string' ? Number(rawLng) : rawLng;
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }
    return { lat, lng };
  }

  private recordFromJson(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const radiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radiusKm * Math.asin(Math.sqrt(h));
  }
}
