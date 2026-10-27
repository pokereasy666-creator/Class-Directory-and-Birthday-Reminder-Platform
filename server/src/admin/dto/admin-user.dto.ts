import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmptyToNull, IsPassword, IsPersonName, PATTERNS, Trim } from '../../common/validation';
import { UpdateProfileDto } from '../../users/dto/update-profile.dto';

export class AdminQueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: '按姓名、学号或账号搜索' })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  keyword?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;
}

/** 管理员在学生可改字段之外，还可修改学号、小组、角色 */
class AdminUserFieldsDto extends UpdateProfileDto {
  @ApiPropertyOptional({
    example: '2022010101',
    nullable: true,
    description: '管理员账号可不填学号',
  })
  @Trim()
  @EmptyToNull()
  @IsOptional()
  @Matches(PATTERNS.studentNo, { message: '学号应为 4~20 位数字' })
  studentNo?: string | null;

  @ApiPropertyOptional({ nullable: true, description: '所属小组，null 表示未分组' })
  @IsOptional()
  @IsInt()
  groupId?: number | null;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;
}

export class AdminUpdateUserDto extends AdminUserFieldsDto {
  @ApiPropertyOptional({ example: '张三' })
  @IsOptional()
  @IsPersonName()
  name?: string;
}

export class AdminCreateUserDto extends AdminUserFieldsDto {
  @ApiProperty({ example: '张三' })
  @IsPersonName()
  name: string;

  @ApiPropertyOptional({ example: 'monitor', description: '登录账号，不填则使用学号' })
  @Trim()
  @EmptyToNull()
  @IsOptional()
  @Matches(PATTERNS.username, { message: '账号应为 3~32 位字母、数字或下划线' })
  username?: string | null;

  @ApiProperty({ description: '初始密码，用户首次登录后需修改' })
  @IsPassword()
  password: string;
}

export class UpdateStatusDto {
  @ApiProperty({
    enum: ['ACTIVE', 'DISABLED'],
    description: 'ACTIVE：审核通过/启用；DISABLED：禁用',
  })
  @IsIn(['ACTIVE', 'DISABLED'], { message: '状态只能是 ACTIVE 或 DISABLED' })
  status: 'ACTIVE' | 'DISABLED';
}

export class ResetPasswordDto {
  @ApiProperty({ description: '新的初始密码，用户下次登录后需修改' })
  @IsPassword()
  password: string;
}
