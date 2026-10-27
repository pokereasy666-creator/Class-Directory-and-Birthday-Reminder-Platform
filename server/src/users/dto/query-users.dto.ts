import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Trim } from '../../common/validation';

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: '按姓名或学号模糊搜索' })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  keyword?: string;

  @ApiPropertyOptional({ description: '按小组筛选' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;
}
