import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export type NotificationInput = Omit<
  Prisma.NotificationCreateManyInput,
  'id' | 'createdAt' | 'readAt'
>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, query: QueryNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async unreadCount(userId: number) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: number, id: number) {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('通知不存在');
    if (!found.readAt) {
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
  }

  async markAllRead(userId: number) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count };
  }

  /**
   * 批量写入通知，已存在的（同一用户、类型、关联对象、日期）跳过。
   * 返回真正新增的那部分，供调用方决定是否再发邮件，保证重复执行不会重复打扰。
   */
  async createIfAbsent(rows: NotificationInput[]): Promise<NotificationInput[]> {
    if (!rows.length) return [];
    const existing = await this.prisma.notification.findMany({
      where: {
        OR: rows.map(({ userId, type, relatedId, refDate }) => ({
          userId,
          type,
          relatedId,
          refDate,
        })),
      },
      select: { userId: true, type: true, relatedId: true, refDate: true },
    });
    const key = (r: {
      userId: number;
      type: NotificationType;
      relatedId?: number;
      refDate?: string;
    }) => `${r.userId}|${r.type}|${r.relatedId ?? 0}|${r.refDate ?? ''}`;
    const seen = new Set(existing.map(key));
    const fresh = rows.filter((r) => !seen.has(key(r)));
    if (fresh.length) {
      await this.prisma.notification.createMany({ data: fresh, skipDuplicates: true });
    }
    return fresh;
  }
}
