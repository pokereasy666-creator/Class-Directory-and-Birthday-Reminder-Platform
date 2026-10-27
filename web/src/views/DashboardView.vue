<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminApi, announcementApi, birthdayApi } from '@/api';
import type { AdminStats, Announcement, BirthdayEntry } from '@/api/types';
import BirthdayList from '@/components/BirthdayList.vue';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();
const upcoming = ref<BirthdayEntry[]>([]);
const announcements = ref<Announcement[]>([]);
const stats = ref<AdminStats | null>(null);
const loading = ref(true);

const todayEntries = computed(() => upcoming.value.filter((e) => e.daysLeft === 0));
const isMyBirthday = computed(() => todayEntries.value.some((e) => e.user.id === auth.user?.id));
const othersToday = computed(() => todayEntries.value.filter((e) => e.user.id !== auth.user?.id));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
});

onMounted(async () => {
  try {
    const [list, ann, s] = await Promise.all([
      birthdayApi.upcoming(7),
      announcementApi.list({ page: 1, pageSize: 3 }),
      auth.isAdmin ? adminApi.stats() : Promise.resolve(null),
    ]);
    upcoming.value = list;
    announcements.value = ann.items;
    stats.value = s;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="dashboard">
    <div v-if="isMyBirthday" class="banner mine">
      <div class="emoji">🎂🎉</div>
      <div>
        <div class="banner-title">{{ auth.user?.name }}，生日快乐！</div>
        <div>全班同学祝你天天开心，万事顺意～</div>
      </div>
    </div>
    <div v-if="othersToday.length" class="banner">
      <div class="emoji">🎈</div>
      <div>
        <div class="banner-title">
          今天是 {{ othersToday.map((e) => e.user.name).join('、') }} 的生日
        </div>
        <div>别忘了送上你的祝福！</div>
      </div>
    </div>

    <h2 class="page-title">{{ greeting }}，{{ auth.user?.name }}</h2>

    <el-alert
      v-if="auth.user && !auth.user.birthday"
      type="warning"
      show-icon
      :closable="false"
      class="tip"
      title="你还没有设置生日，设置后同学们就能按时收到提醒"
    >
      <router-link to="/profile">去设置</router-link>
    </el-alert>

    <el-row :gutter="16">
      <el-col v-if="stats" :xs="24" class="block">
        <el-card shadow="never">
          <div class="stats">
            <div class="stat" @click="router.push('/admin/users')">
              <div class="num">{{ stats.active }}</div>
              <div class="muted">正常账号</div>
            </div>
            <div
              class="stat warn"
              @click="router.push({ path: '/admin/users', query: { status: 'PENDING' } })"
            >
              <div class="num">{{ stats.pending }}</div>
              <div class="muted">待审核</div>
            </div>
            <div class="stat" @click="router.push('/admin/users')">
              <div class="num">{{ stats.disabled }}</div>
              <div class="muted">已禁用</div>
            </div>
            <div class="stat" @click="router.push('/admin/birthdays')">
              <div class="num">{{ stats.missingBirthday }}</div>
              <div class="muted">未填生日</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14" class="block">
        <el-card shadow="never">
          <template #header>
            <div class="card-head">
              <span>🎁 近 7 天生日</span>
              <router-link to="/birthdays">查看全部</router-link>
            </div>
          </template>
          <BirthdayList
            :entries="upcoming"
            :loading="loading"
            empty-text="未来 7 天没有同学过生日"
          />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10" class="block">
        <el-card shadow="never">
          <template #header>
            <div class="card-head">
              <span>📢 最新公告</span>
              <router-link to="/announcements">更多</router-link>
            </div>
          </template>
          <el-empty
            v-if="!announcements.length && !loading"
            description="暂无公告"
            :image-size="80"
          />
          <div
            v-for="a in announcements"
            :key="a.id"
            class="ann"
            @click="router.push({ path: '/announcements', query: { id: a.id } })"
          >
            <div class="ann-title">
              <el-tag v-if="a.pinned" size="small" type="danger">置顶</el-tag>
              {{ a.title }}
            </div>
            <div class="muted">{{ formatDateTime(a.createdAt) }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 16px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(120deg, #409eff, #79bbff);
}
.banner.mine {
  background: linear-gradient(120deg, #f56c6c, #f89898 60%, #e6a23c);
}
.emoji {
  font-size: 36px;
}
.banner-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}
.tip {
  margin-bottom: 16px;
}
.block {
  margin-bottom: 16px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
}
.stat {
  cursor: pointer;
}
.stat .num {
  font-size: 26px;
  font-weight: 600;
}
.stat.warn .num {
  color: var(--el-color-warning);
}
.ann {
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}
.ann:last-child {
  border-bottom: none;
}
.ann-title {
  margin-bottom: 4px;
}
</style>
