import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types';
import { toProfile, withGroup } from '../users/user.mapper';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.studentNo }, { studentNo: dto.studentNo }] },
    });
    if (exists) throw new ConflictException('该学号已注册');

    await this.prisma.user.create({
      data: {
        username: dto.studentNo,
        studentNo: dto.studentNo,
        name: dto.name,
        phone: dto.phone ?? null,
        passwordHash: await hashPassword(dto.password),
        // 新注册账号需管理员审核后才能登录查看通讯录
        status: 'PENDING',
      },
    });
    return { message: '注册成功，请等待管理员审核' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      omit: { passwordHash: false },
      include: withGroup,
    });
    // 账号不存在与密码错误返回同一提示，避免泄露哪些学号已注册
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (user.status === 'PENDING') throw new ForbiddenException('账号正在等待管理员审核');
    if (user.status === 'DISABLED') throw new ForbiddenException('账号已被禁用，请联系管理员');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: withGroup,
    });
    return { token: this.sign(updated), user: toProfile(updated) };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: withGroup,
    });
    return toProfile(user);
  }

  /** 修改密码后旧 token 全部失效，返回新 token 让当前会话继续使用 */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      omit: { passwordHash: false },
    });
    if (!(await verifyPassword(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException('原密码不正确');
    }
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
      include: withGroup,
    });
    return { token: this.sign(updated), user: toProfile(updated) };
  }

  private sign(user: Pick<User, 'id' | 'tokenVersion'>): string {
    const payload: JwtPayload = { sub: user.id, ver: user.tokenVersion };
    return this.jwt.sign(payload);
  }
}
