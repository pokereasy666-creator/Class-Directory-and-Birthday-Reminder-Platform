import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupDto } from './dto/group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.classGroup.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { users: { where: { status: 'ACTIVE' } } } } },
    });
    return groups.map(({ _count, ...g }) => ({ ...g, memberCount: _count.users }));
  }

  create(dto: GroupDto) {
    return this.prisma.classGroup.create({ data: dto });
  }

  update(id: number, dto: GroupDto) {
    return this.prisma.classGroup.update({ where: { id }, data: dto });
  }

  /** 删除小组后，组内成员变为"未分组"（外键 ON DELETE SET NULL） */
  async remove(id: number) {
    await this.prisma.classGroup.delete({ where: { id } });
  }
}
