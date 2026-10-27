import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { Trim } from '../../common/validation';

export class AnnouncementDto {
  @ApiProperty({ example: '周五班会通知' })
  @Trim()
  @IsString()
  @Length(1, 100, { message: '标题应为 1~100 个字符' })
  title: string;

  @ApiProperty({ example: '本周五下午 4 点在 A101 召开班会，请准时参加。' })
  @Trim()
  @IsString()
  @Length(1, 5000, { message: '内容应为 1~5000 个字符' })
  content: string;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
