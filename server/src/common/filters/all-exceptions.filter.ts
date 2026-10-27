import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  username: '账号',
  student_no: '学号',
  name: '名称',
};

/** 统一错误响应格式 { code: HTTP 状态码, message, data: null } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, message] = this.resolve(exception);
    res.status(status).json({ code: status, message, data: null });
  }

  private resolve(exception: unknown): [number, string] {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === HttpStatus.PAYLOAD_TOO_LARGE)
        return [status, '上传文件过大，图片不能超过 2MB'];
      if (status === HttpStatus.TOO_MANY_REQUESTS) return [status, '操作太频繁，请稍后再试'];
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      // class-validator 返回的是错误数组，只展示第一条
      return [status, (Array.isArray(message) ? message[0] : message) ?? exception.message];
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = String((exception.meta?.target as string | string[] | undefined) ?? '');
        const field = Object.keys(UNIQUE_FIELD_LABELS).find((key) => target.includes(key));
        return [HttpStatus.CONFLICT, `${field ? UNIQUE_FIELD_LABELS[field] : '数据'}已存在`];
      }
      if (exception.code === 'P2025') return [HttpStatus.NOT_FOUND, '数据不存在'];
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return [HttpStatus.INTERNAL_SERVER_ERROR, '服务器内部错误'];
  }
}
