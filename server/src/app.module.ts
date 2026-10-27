import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthModule } from './auth/auth.module';
import { BirthdaysModule } from './birthdays/birthdays.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GroupsModule } from './groups/groups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 全局限流：每个 IP 每分钟 300 次；登录注册接口单独收紧
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    BirthdaysModule,
    GroupsModule,
    AnnouncementsModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    // 守卫按注册顺序执行：限流 → 登录校验 → 角色/初始密码校验
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
