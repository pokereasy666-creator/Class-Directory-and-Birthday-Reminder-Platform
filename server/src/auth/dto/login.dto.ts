import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '../../common/validation';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: '学生为学号，管理员为管理员账号' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  username: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  password: string;
}
