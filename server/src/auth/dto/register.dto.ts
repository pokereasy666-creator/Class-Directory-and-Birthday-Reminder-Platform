import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsPassword, IsPersonName, IsStudentNo, OptionalPhone } from '../../common/validation';

export class RegisterDto {
  @ApiProperty({ example: '2022010101', description: '学号，同时作为登录账号' })
  @IsStudentNo()
  studentNo: string;

  @ApiProperty({ example: '张三' })
  @IsPersonName()
  name: string;

  @ApiProperty({ example: 'abc123' })
  @IsPassword()
  password: string;

  @ApiPropertyOptional({ example: '13800138000' })
  @OptionalPhone()
  phone?: string | null;
}
