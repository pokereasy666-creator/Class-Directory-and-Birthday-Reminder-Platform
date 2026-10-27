import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 统一成功响应格式 { code: 0, message: 'success', data }，文件下载除外 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((data) =>
          data instanceof StreamableFile
            ? data
            : ({ code: 0, message: 'success', data: data ?? null } satisfies ApiResponse<unknown>),
        ),
      );
  }
}
