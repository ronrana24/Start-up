import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

type DeliverySocketData = {
  user?: User;
  riderId?: string;
};

type SubscribeOrderPayload = {
  orderId?: string;
};

@WebSocketGateway({
  namespace: 'delivery',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class DeliveryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(DeliveryGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      client.disconnect(true);
      return;
    }

    client.data = { user } satisfies DeliverySocketData;
    await client.join([`user:${user.id}`, `role:${user.role}`]);

    if (user.role === UserRole.ADMIN) {
      await client.join('admin');
    }

    if (user.role === UserRole.RIDER) {
      const rider = await this.prisma.rider.findUnique({
        where: { userId: user.id },
      });
      if (rider) {
        client.data.riderId = rider.id;
        await client.join(`rider:${rider.id}`);
        if (rider.status === 'IDLE') {
          await client.join('available-riders');
        }
        this.emitToRooms(['admin'], 'rider.presence_changed', {
          riderId: rider.id,
          online: true,
          at: new Date().toISOString(),
        });
      }
    }
  }

  handleDisconnect(client: Socket) {
    const riderId = (client.data as DeliverySocketData | undefined)?.riderId;
    if (!riderId) {
      return;
    }
    this.emitToRooms(['admin'], 'rider.presence_changed', {
      riderId,
      online: false,
      at: new Date().toISOString(),
    });
  }

  @SubscribeMessage('order:subscribe')
  async subscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeOrderPayload,
  ) {
    const user = (client.data as DeliverySocketData).user;
    const orderId = payload?.orderId;
    if (!user || !orderId) {
      return { ok: false };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, riderId: true },
    });
    if (!order) {
      return { ok: false };
    }

    const riderId = (client.data as DeliverySocketData).riderId;
    const canSubscribe =
      user.role === UserRole.ADMIN ||
      order.userId === user.id ||
      (riderId != null && order.riderId === riderId);

    if (!canSubscribe) {
      return { ok: false };
    }

    await client.join(`order:${order.id}`);
    return { ok: true };
  }

  emitToRooms(rooms: string[], event: string, payload: unknown) {
    if (!this.server) {
      this.logger.debug(`Skipped ${event}; delivery gateway not ready`);
      return;
    }
    this.server.to(rooms).emit(event, this.serialize(payload));
  }

  setRiderAvailableRoom(riderId: string, available: boolean) {
    if (!this.server) {
      this.logger.debug(
        `Skipped rider room update for ${riderId}; delivery gateway not ready`,
      );
      return;
    }
    const riderRoom = this.server.in(`rider:${riderId}`);
    if (available) {
      riderRoom.socketsJoin('available-riders');
    } else {
      riderRoom.socketsLeave('available-riders');
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string') {
      const [scheme, value] = header.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) {
        return value.trim();
      }
    }

    const cookieName = this.config.getOrThrow<string>('auth.cookie.name');
    const cookies = client.handshake.headers.cookie;
    if (typeof cookies !== 'string') {
      return null;
    }
    for (const part of cookies.split(';')) {
      const [rawName, ...rawValue] = part.trim().split('=');
      if (rawName === cookieName) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return null;
  }

  private serialize(payload: unknown): unknown {
    return JSON.parse(JSON.stringify(payload));
  }
}
