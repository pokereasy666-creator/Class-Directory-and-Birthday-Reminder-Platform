import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { formatBirthday } from '../birthdays/birthday.util';
import { PrismaService } from '../prisma/prisma.service';
import { toBirthday, withGroup } from '../users/user.mapper';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /** 导出全班（正常状态账号）通讯录为 Excel */
  async directoryXlsx(): Promise<Buffer> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      include: withGroup,
      orderBy: [{ role: 'desc' }, { studentNo: 'asc' }, { id: 'asc' }],
    });

    const workbook = new Workbook();
    workbook.creator = '班级通讯录与生日提醒平台';
    const sheet = workbook.addWorksheet('班级通讯录', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: '序号', key: 'index', width: 6 },
      { header: '学号', key: 'studentNo', width: 14 },
      { header: '姓名', key: 'name', width: 10 },
      { header: '身份', key: 'role', width: 8 },
      { header: '小组', key: 'group', width: 10 },
      { header: '手机', key: 'phone', width: 14 },
      { header: 'QQ', key: 'qq', width: 13 },
      { header: '邮箱', key: 'email', width: 24 },
      { header: '宿舍', key: 'dorm', width: 14 },
      { header: '生日', key: 'birthday', width: 18 },
      { header: '备注', key: 'remark', width: 30 },
    ];
    users.forEach((u, i) => {
      const birthday = toBirthday(u);
      sheet.addRow({
        index: i + 1,
        studentNo: u.studentNo ?? '',
        name: u.name,
        role: u.role === 'ADMIN' ? '管理员' : '学生',
        group: u.group?.name ?? '',
        phone: u.phone ?? '',
        qq: u.qq ?? '',
        email: u.email ?? '',
        dorm: u.dorm ?? '',
        birthday: birthday ? formatBirthday(birthday) : '',
        remark: u.remark ?? '',
      });
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    // 学号、手机、QQ 按文本存储，避免 Excel 显示为科学计数法
    for (const key of ['studentNo', 'phone', 'qq']) sheet.getColumn(key).numFmt = '@';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
