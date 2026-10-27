import { Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, User } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementDto } from './dto/announcement.dto';

const withAuthor = { author: { select: { id: true, name: true } } } as const;

type AnnouncementRecord = Announcement & { author: Pick<User, 'id' | 'name'> | null };

function toView({ authorId: _authorId, ...a }: AnnouncementRecord) {
  return a;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        include: withAuthor,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.announcement.count(),
    ]);
    return { items: items.map(toView), total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: number) {
    const found = await this.prisma.announcement.findUnique({ where: { id }, include: withAuthor });
    if (!found) throw new NotFoundException('公告不存在');
    return toView(found);
  }

  /** 发布公告，同时给全班（除发布者）生成站内通知 */
  async create(authorId: number, dto: AnnouncementDto) {
    const created = await this.prisma.announcement.create({
      data: { ...dto, authorId },
      include: withAuthor,
    });
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: authorId } },
      select: { id: true },
    });
    await this.notifications.createIfAbsent(
      users.map((u) => ({
        userId: u.id,
        type: 'ANNOUNCEMENT' as const,
        relatedId: created.id,
        title: `新公告：${created.title}`,
        content:
          created.content.length > 100 ? `${created.content.slice(0, 100)}…` : created.content,
      })),
    );
    return toView(created);
  }

  async update(id: number, dto: AnnouncementDto) {
    return toView(
      await this.prisma.announcement.update({ where: { id }, data: dto, include: withAuthor }),
    );
  }

  async remove(id: number) {
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT', relatedId: id } }),
      this.prisma.announcement.delete({ where: { id } }),
    ]);
  }
}
