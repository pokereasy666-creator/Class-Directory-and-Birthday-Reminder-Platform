import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paged } from '../common/types';
import { detectImageExt, removeUpload, saveUpload } from '../common/upload.util';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { birthdayToData, toDirectoryItem, toProfile, withGroup } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 关键字同时匹配姓名和学号 */
  static keywordFilter(keyword?: string): Prisma.UserWhereInput {
    return keyword
      ? { OR: [{ name: { contains: keyword } }, { studentNo: { contains: keyword } }] }
      : {};
  }

  async directory(query: QueryUsersDto): Promise<Paged<ReturnType<typeof toDirectoryItem>>> {
    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      ...UsersService.keywordFilter(query.keyword),
      ...(query.groupId ? { groupId: query.groupId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: withGroup,
        // 管理员（班主任、班长）排在前面，其余按学号
        orderBy: [{ role: 'desc' }, { studentNo: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toDirectoryItem), total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE' },
      include: withGroup,
    });
    if (!user) throw new NotFoundException('同学不存在');
    return toDirectoryItem(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const { birthday, ...fields } = dto;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...fields, ...birthdayToData(birthday) },
      include: withGroup,
    });
    return toProfile(user);
  }

  async updateAvatar(userId: number, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('请选择图片');
    const ext = detectImageExt(file.buffer);
    if (!ext) throw new BadRequestException('只支持 JPG、PNG、WEBP 格式的图片');

    const old = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const avatar = await saveUpload('avatars', file.buffer, ext);
    await this.prisma.user.update({ where: { id: userId }, data: { avatar } });
    await removeUpload(old.avatar);
    return { avatar };
  }
}
