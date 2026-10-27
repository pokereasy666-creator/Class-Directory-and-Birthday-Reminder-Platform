<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, ref, watch } from 'vue';
import { birthdayApi, directoryApi } from '@/api';
import type { BirthdayEntry, DirectoryUser } from '@/api/types';
import BirthdayList from '@/components/BirthdayList.vue';
import UserDetailDrawer from '@/components/UserDetailDrawer.vue';

const tab = ref<'upcoming' | 'month' | 'calendar'>('upcoming');

const days = ref(7);
const upcoming = ref<BirthdayEntry[]>([]);
const upcomingLoading = ref(false);

const thisMonth = ref<BirthdayEntry[]>([]);
const monthLoading = ref(false);

const calendarDate = ref(new Date());
const calendarEntries = ref<BirthdayEntry[]>([]);
const calendarLoading = ref(false);
const calendarKey = computed(() => dayjs(calendarDate.value).format('YYYY-MM'));
const byDate = computed(() => {
  const map = new Map<string, BirthdayEntry[]>();
  for (const e of calendarEntries.value) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return map;
});

const selected = ref<DirectoryUser | null>(null);
const drawerVisible = ref(false);

async function loadUpcoming() {
  upcomingLoading.value = true;
  try {
    upcoming.value = await birthdayApi.upcoming(days.value);
  } finally {
    upcomingLoading.value = false;
  }
}

async function loadThisMonth() {
  monthLoading.value = true;
  try {
    const now = dayjs();
    thisMonth.value = await birthdayApi.month(now.year(), now.month() + 1);
  } finally {
    monthLoading.value = false;
  }
}

async function loadCalendar() {
  calendarLoading.value = true;
  try {
    const d = dayjs(calendarDate.value);
    calendarEntries.value = await birthdayApi.month(d.year(), d.month() + 1);
  } finally {
    calendarLoading.value = false;
  }
}

async function showUser(userId: number) {
  selected.value = await directoryApi.detail(userId);
  drawerVisible.value = true;
}

watch(days, loadUpcoming);
watch(calendarKey, loadCalendar);
watch(tab, (t) => {
  if (t === 'month' && !thisMonth.value.length) void loadThisMonth();
  if (t === 'calendar' && !calendarEntries.value.length) void loadCalendar();
});
onMounted(loadUpcoming);
</script>

<template>
  <el-card shadow="never">
    <el-tabs v-model="tab">
      <el-tab-pane label="近期生日" name="upcoming">
        <div class="toolbar">
          <el-radio-group v-model="days" size="small">
            <el-radio-button :value="7">近 7 天</el-radio-button>
            <el-radio-button :value="14">近 14 天</el-radio-button>
            <el-radio-button :value="30">近 30 天</el-radio-button>
          </el-radio-group>
          <span class="muted">共 {{ upcoming.length }} 人</span>
        </div>
        <BirthdayList
          :entries="upcoming"
          :loading="upcomingLoading"
          :empty-text="`未来 ${days} 天没有同学过生日`"
          @select="showUser($event.user.id)"
        />
      </el-tab-pane>

      <el-tab-pane label="本月生日" name="month">
        <p class="muted">
          {{ dayjs().format('YYYY年M月') }}过生日的同学（农历生日按今年对应的公历日期计算）
        </p>
        <BirthdayList
          :entries="thisMonth"
          :loading="monthLoading"
          empty-text="本月没有同学过生日"
          @select="showUser($event.user.id)"
        />
      </el-tab-pane>

      <el-tab-pane label="生日月历" name="calendar">
        <el-calendar v-model="calendarDate" v-loading="calendarLoading">
          <template #date-cell="{ data }">
            <div class="cell" :class="{ other: data.type !== 'current-month' }">
              <div class="day">{{ Number(data.day.slice(8)) }}</div>
              <template v-if="data.type === 'current-month'">
                <div
                  v-for="e in byDate.get(data.day) ?? []"
                  :key="e.user.id"
                  class="who"
                  :title="`${e.user.name} · ${e.birthdayText}`"
                  @click.stop="showUser(e.user.id)"
                >
                  🎂 {{ e.user.name }}
                </div>
              </template>
            </div>
          </template>
        </el-calendar>
      </el-tab-pane>
    </el-tabs>
    <UserDetailDrawer v-model:visible="drawerVisible" :user="selected" />
  </el-card>
</template>

<style scoped>
.cell {
  height: 100%;
  overflow: hidden;
}
.cell.other {
  opacity: 0.4;
}
.day {
  font-size: 13px;
  margin-bottom: 2px;
}
.who {
  font-size: 12px;
  line-height: 18px;
  padding: 0 4px;
  margin-bottom: 2px;
  border-radius: 4px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:deep(.el-calendar-table .el-calendar-day) {
  height: 76px;
  padding: 4px;
}
@media (max-width: 768px) {
  :deep(.el-calendar-table .el-calendar-day) {
    height: 56px;
    padding: 2px;
  }
  .who {
    font-size: 10px;
    padding: 0 2px;
  }
}
</style>
