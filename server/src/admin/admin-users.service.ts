import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword } from '../auth/password.util';
import { removeUpload } from '../common/upload.util';
import { PrismaService } from '../prisma/prisma.service';
import { birthdayToData, toProfile, withGroup } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import {
  AdminCreateUserDto,
  AdminQueryUsersDto,
  AdminUpdateUserDto,
  ResetPasswordDto,
  UpdateStatusDto,
} from './dto/admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminQueryUsersDto) {
    const keyword = query.keyword;
    const where: Prisma.UserWhereInput = {
      ...(keyword
        ? { OR: [...UsersService.keywordFilter(keyword).OR!, { username: { contains: keyword } }] }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: withGroup,
        // 待审核排最前，其次按学号
        orderBy: [{ status: 'asc' }, { studentNo: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toProfile), total, page: query.page, pageSize: query.pageSize };
  }

  async stats() {
    const [byStatus, missingBirthday] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: true }),
      this.prisma.user.count({ where: { status: 'ACTIVE', birthdayCalendar: null } }),
    ]);
    const count = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
    return {
      total: byStatus.reduce((sum, x) => sum + x._count, 0),
      active: count('ACTIVE'),
      pending: count('PENDING'),
      disabled: count('DISABLED'),
      missingBirthday,
    };
  }

  /** 管理员直接新建的账号无需审核，但首次登录必须修改初始密码 */
  async create(dto: AdminCreateUserDto) {
    const { password, birthday, username, groupId, ...fields } = dto;
    const role = dto.role ?? 'STUDENT';
    if (role === 'STUDENT' && !dto.studentNo) throw new BadRequestException('学生账号必须填写学号');
    const loginName = username || dto.studentNo;
    if (!loginName) throw new BadRequestException('请填写登录账号或学号');
    await this.ensureUnique(loginName, dto.studentNo);

    const user = await this.prisma.user.create({
      data: {
        ...fields,
        ...birthdayToData(birthday),
        role,
        username: loginName,
        group: groupId ? { connect: { id: groupId } } : undefined,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        mustChangePassword: true,
      },
      include: withGroup,
    });
    return toProfile(user);
  }

  async update(operatorId: number, id: number, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const { birthday, groupId, ...fields } = dto;
    if (id === operatorId && dto.role && dto.role !== target.role) {
      throw new ForbiddenException('不能修改自己的角色');
    }
    const role = dto.role ?? target.role;
    const studentNo = dto.studentNo === undefined ? target.studentNo : dto.studentNo;
    if (role === 'STUDENT' && !studentNo) throw new BadRequestException('学生账号必须填写学号');

    // 学生的登录账号就是学号，管理员纠正学号时同步修改登录账号
    const syncUsername =
      dto.studentNo && target.studentNo !== dto.studentNo && target.username === target.studentNo;
    if (dto.studentNo && dto.studentNo !== target.studentNo) {
      await this.ensureUnique(syncUsername ? dto.studentNo : null, dto.studentNo, id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...fields,
        ...birthdayToData(birthday),
        ...(syncUsername ? { username: dto.studentNo! } : {}),
        ...(groupId === undefined
          ? {}
          : { group: groupId === null ? { disconnect: true } : { connect: { id: groupId } } }),
      },
      include: withGroup,
    });
    return toProfile(user);
  }

  /** 审核通过、启用、禁用。禁用时让该用户已登录的 token 立即失效 */
  async setStatus(operatorId: number, id: number, dto: UpdateStatusDto) {
    if (id === operatorId) throw new ForbiddenException('不能修改自己的账号状态');
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'DISABLED' ? { tokenVersion: { increment: 1 } } : {}),
      },
      include: withGroup,
    });
    return toProfile(user);
  }

  async resetPassword(id: number, dto: ResetPasswordDto) {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(dto.password),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });
  }

  /** 删除学生（也用于驳回注册申请），同时清理与其相关的生日通知和头像文件 */
  async remove(operatorId: number, id: number) {
    if (id === operatorId) throw new ForbiddenException('不能删除自己的账号');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { relatedId: id, type: { in: ['BIRTHDAY_TODAY', 'BIRTHDAY_UPCOMING'] } },
      }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await removeUpload(user.avatar);
  }

  private async ensureUnique(
    username: string | null,
    studentNo?: string | null,
    excludeId?: number,
  ) {
    const or: Prisma.UserWhereInput[] = [];
    if (username) or.push({ username });
    if (studentNo) or.push({ studentNo });
    if (!or.length) return;
    const exists = await this.prisma.user.findFirst({
      where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (exists) {
      throw new ConflictException(exists.studentNo === studentNo ? '学号已存在' : '账号已存在');
    }
  }
}
