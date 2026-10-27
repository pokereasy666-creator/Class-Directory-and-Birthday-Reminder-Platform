import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Trim } from '../../common/validation';

export class GroupDto {
  @ApiProperty({ example: '第一组' })
  @Trim()
  @IsString()
  @Length(1, 30, { message: '小组名称应为 1~30 个字符' })
  name: string;

  @ApiPropertyOptional({ description: '排序，越小越靠前', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;
}
