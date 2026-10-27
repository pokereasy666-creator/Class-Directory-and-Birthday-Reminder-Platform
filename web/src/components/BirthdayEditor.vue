<script setup lang="ts">
import { computed } from 'vue';
import type { BirthdayInput, CalendarType } from '@/api/types';
import { LUNAR_DAYS, LUNAR_MONTHS, SOLAR_MONTH_DAYS } from '@/utils/birthday';

/** 生日编辑：公历/农历、可不填出生年份、农历闰月。null 表示未设置 */
const model = defineModel<BirthdayInput | null>({ required: true });

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: model.value?.calendar === 'LUNAR' ? LUNAR_MONTHS[i] : `${i + 1}月`,
  })),
);

const dayOptions = computed(() => {
  const b = model.value;
  if (!b) return [];
  const max = b.calendar === 'LUNAR' ? 30 : SOLAR_MONTH_DAYS[b.month - 1];
  return Array.from({ length: max }, (_, i) => ({
    value: i + 1,
    label: b.calendar === 'LUNAR' ? LUNAR_DAYS[i] : `${i + 1}日`,
  }));
});

const preview = computed(() => {
  const b = model.value;
  if (!b) return '';
  const year = b.year ? `${b.year}年` : '';
  return b.calendar === 'LUNAR'
    ? `农历${year}${b.isLeapMonth ? '闰' : ''}${LUNAR_MONTHS[b.month - 1]}${LUNAR_DAYS[b.day - 1]}`
    : `${year}${b.month}月${b.day}日`;
});

function patch(changes: Partial<BirthdayInput>) {
  const next = { ...model.value!, ...changes };
  if (next.calendar === 'SOLAR') next.isLeapMonth = false;
  // 切换月份或历法后，日期超出当月天数时自动调整
  const max = next.calendar === 'LUNAR' ? 30 : SOLAR_MONTH_DAYS[next.month - 1];
  next.day = Math.min(next.day, max);
  model.value = next;
}

function enable() {
  model.value = { calendar: 'SOLAR', year: null, month: 1, day: 1, isLeapMonth: false };
}
</script>

<template>
  <div class="birthday-editor">
    <el-button v-if="!model" plain type="primary" @click="enable">设置生日</el-button>
    <template v-else>
      <div class="row">
        <el-radio-group
          :model-value="model.calendar"
          @update:model-value="patch({ calendar: $event as CalendarType })"
        >
          <el-radio-button value="SOLAR">公历</el-radio-button>
          <el-radio-button value="LUNAR">农历</el-radio-button>
        </el-radio-group>
        <el-button link type="danger" @click="model = null">清除生日</el-button>
      </div>
      <div class="row">
        <el-select
          :model-value="model.year ?? undefined"
          placeholder="出生年份（可不填）"
          clearable
          filterable
          class="year"
          @update:model-value="patch({ year: $event ?? null })"
        >
          <el-option v-for="y in years" :key="y" :label="`${y}年`" :value="y" />
        </el-select>
        <el-select
          :model-value="model.month"
          class="md"
          aria-label="月份"
          @update:model-value="patch({ month: $event })"
        >
          <el-option v-for="m in monthOptions" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
        <el-select
          :model-value="model.day"
          class="md"
          aria-label="日期"
          @update:model-value="patch({ day: $event })"
        >
          <el-option v-for="d in dayOptions" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <el-checkbox
          v-if="model.calendar === 'LUNAR'"
          :model-value="model.isLeapMonth"
          @update:model-value="patch({ isLeapMonth: !!$event })"
        >
          闰月
        </el-checkbox>
      </div>
      <div class="muted">
        {{ preview }}
        <template v-if="model.calendar === 'LUNAR'">
          · 每年会自动换算成对应的公历日期提醒
        </template>
        <template v-if="!model.year"> · 不填年份则不显示年龄</template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.birthday-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.year {
  width: 170px;
}
.md {
  width: 100px;
}
</style>
