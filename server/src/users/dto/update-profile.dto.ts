import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, ValidateNested } from 'class-validator';
import {
  EmptyToNull,
  OptionalPhone,
  OptionalQq,
  OptionalText,
  Trim,
} from '../../common/validation';
import { BirthdayDto } from './birthday.dto';

/**
 * 学生可自行修改的资料。
 * 姓名、学号是管理员审核注册时的依据，只允许管理员修改。
 * 字段为 undefined 表示不修改，为 null（或空字符串）表示清空。
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '13800138000', nullable: true })
  @OptionalPhone()
  phone?: string | null;

  @ApiPropertyOptional({ example: '123456789', nullable: true })
  @OptionalQq()
  qq?: string | null;

  @ApiPropertyOptional({ example: 'someone@example.com', nullable: true })
  @Trim()
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string | null;

  @ApiPropertyOptional({ example: '3号楼 402', nullable: true })
  @OptionalText(50, '宿舍')
  dorm?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @OptionalText(200, '备注')
  remark?: string | null;

  @ApiPropertyOptional({ type: BirthdayDto, nullable: true, description: '传 null 清除生日' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BirthdayDto)
  birthday?: BirthdayDto | null;

  @ApiPropertyOptional({ description: '是否接收生日提醒邮件' })
  @IsOptional()
  @IsBoolean()
  emailNotify?: boolean;
}
