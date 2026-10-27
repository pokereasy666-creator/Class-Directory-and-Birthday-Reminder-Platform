<script setup lang="ts">
import { Bell, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import { adminApi } from '@/api';
import type { BirthdayEntry, UserBrief } from '@/api/types';
import UserAvatar from '@/components/UserAvatar.vue';
import { daysLeftTagType, daysLeftText } from '@/utils/birthday';
import { alertLines } from '@/utils/dialog';
import { formatMonthDay, saveBlob } from '@/utils/format';

const entries = ref<BirthdayEntry[]>([]);
const missing = ref<UserBrief[]>([]);
const loading = ref(false);
const exporting = ref(false);
const running = ref(false);
const reminderDate = ref<string>('');

async function load() {
  loading.value = true;
  try {
    const res = await adminApi.birthdays();
    entries.value = res.entries;
    missing.value = res.missing;
  } finally {
    loading.value = false;
  }
}

async function exportDirectory() {
  exporting.value = true;
  try {
    const { blob, filename } = await adminApi.exportDirectory();
    saveBlob(blob, filename);
    ElMessage.success('已导出');
  } finally {
    exporting.value = false;
  }
}

async function runReminder() {
  running.value = true;
  try {
    const r = await adminApi.runReminder(reminderDate.value || undefined);
    await alertLines(
      [
        `执行日期：${r.date}`,
        `今天过生日：${r.birthdayToday} 人`,
        `即将过生日：${r.birthdayUpcoming} 人`,
        `新发送站内通知：${r.created} 条（已发送过的不会重复发送）`,
        `发送邮件：${r.emailed} 封`,
      ],
      '生日提醒已执行',
    );
  } finally {
    running.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <el-card shadow="never" class="block">
      <div class="toolbar actions">
        <el-button type="primary" :icon="Download" :loading="exporting" @click="exportDirectory">
          导出通讯录 Excel
        </el-button>
        <span class="spacer" />
        <el-date-picker
          v-model="reminderDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="按今天执行"
          style="width: 160px"
        />
        <el-button :icon="Bell" :loading="running" @click="runReminder">立即执行生日提醒</el-button>
      </div>
      <div class="muted">
        系统每天早上 8 点自动执行生日提醒；手动执行可指定日期，用于演示或补发。
      </div>
    </el-card>

    <el-card v-if="missing.length" shadow="never" class="block">
      <template #header>⚠️ 未填写生日（{{ missing.length }} 人）</template>
      <div class="missing">
        <el-tag v-for="u in missing" :key="u.id" effect="plain"
          >{{ u.name }} {{ u.studentNo ?? '' }}</el-tag
        >
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>全部生日记录（按下次生日排序，共 {{ entries.length }} 人）</template>
      <el-table v-loading="loading" :data="entries" stripe>
        <el-table-column label="姓名" min-width="130">
          <template #default="{ row }">
            <div class="name-cell">
              <UserAvatar :name="row.user.name" :avatar="row.user.avatar" :size="28" />
              {{ row.user.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学号" min-width="120">
          <template #default="{ row }">{{ row.user.studentNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="小组" min-width="80">
          <template #default="{ row }">{{ row.user.group?.name ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="birthdayText" label="生日" min-width="150" />
        <el-table-column label="下次生日" min-width="130">
          <template #default="{ row }">{{ formatMonthDay(row.date) }}</template>
        </el-table-column>
        <el-table-column label="倒计时" min-width="100">
          <template #default="{ row }">
            <el-tag :type="daysLeftTagType(row.daysLeft)" size="small">{{
              daysLeftText(row.daysLeft)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="年龄" width="80">
          <template #default="{ row }">{{ row.age ?? '—' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.block {
  margin-bottom: 16px;
}
.actions {
  margin-bottom: 8px;
}
.missing {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
