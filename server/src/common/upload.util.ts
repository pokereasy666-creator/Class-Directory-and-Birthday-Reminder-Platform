import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, normalize } from 'path';

export const UPLOAD_URL_PREFIX = '/uploads';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
}

/**
 * 按文件头（魔数）识别图片类型，不信任客户端传来的 Content-Type 和扩展名，
 * 防止把脚本等文件伪装成图片上传。
 */
export function detectImageExt(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** 保存文件到 uploads/<dir>/，返回可访问的 URL */
export async function saveUpload(dir: string, buf: Buffer, ext: string): Promise<string> {
  const folder = join(uploadRoot(), dir);
  await fs.mkdir(folder, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await fs.writeFile(join(folder, filename), buf);
  return `${UPLOAD_URL_PREFIX}/${dir}/${filename}`;
}

/** 删除之前上传的文件；只处理 /uploads/ 下的路径，失败时忽略 */
export async function removeUpload(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;
  const relative = normalize(url.slice(UPLOAD_URL_PREFIX.length + 1));
  if (relative.startsWith('..')) return;
  await fs.rm(join(uploadRoot(), relative), { force: true }).catch(() => undefined);
}
