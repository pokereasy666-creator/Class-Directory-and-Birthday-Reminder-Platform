<script setup lang="ts">
import { Search } from '@element-plus/icons-vue';
import { onMounted, reactive, ref, watch } from 'vue';
import { directoryApi, groupApi } from '@/api';
import type { DirectoryUser, Group } from '@/api/types';
import UserAvatar from '@/components/UserAvatar.vue';
import UserDetailDrawer from '@/components/UserDetailDrawer.vue';
import { useIsMobile } from '@/composables/useIsMobile';

const isMobile = useIsMobile();
const groups = ref<Group[]>([]);
const items = ref<DirectoryUser[]>([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({
  keyword: '',
  groupId: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});
const selected = ref<DirectoryUser | null>(null);
const drawerVisible = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await directoryApi.list({
      keyword: query.keyword.trim() || undefined,
      groupId: query.groupId,
      page: query.page,
      pageSize: query.pageSize,
    });
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

// 输入关键字 300ms 后自动搜索
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [query.keyword, query.groupId],
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      query.page = 1;
      void load();
    }, 300);
  },
);

function open(user: DirectoryUser) {
  selected.value = user;
  drawerVisible.value = true;
}

onMounted(async () => {
  void load();
  groups.value = await groupApi.list();
});
</script>

<template>
  <div>
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        :prefix-icon="Search"
        placeholder="搜索姓名或学号"
        clearable
        style="width: 240px"
      />
      <el-select v-model="query.groupId" placeholder="全部小组" clearable style="width: 160px">
        <el-option
          v-for="g in groups"
          :key="g.id"
          :label="`${g.name}（${g.memberCount}人）`"
          :value="g.id"
        />
      </el-select>
      <span class="spacer" />
      <span class="muted">共 {{ total }} 人</span>
    </div>

    <div v-if="isMobile" v-loading="loading" class="cards">
      <el-empty v-if="!items.length && !loading" description="没有找到同学" />
      <div v-for="u in items" :key="u.id" class="card" @click="open(u)">
        <UserAvatar :name="u.name" :avatar="u.avatar" :size="44" />
        <div class="info">
          <div class="name">
            {{ u.name }}
            <el-tag v-if="u.role === 'ADMIN'" size="small" type="warning">管理员</el-tag>
          </div>
          <div class="muted">{{ u.studentNo ?? '—' }} · {{ u.group?.name ?? '未分组' }}</div>
          <div class="muted">{{ u.dorm ?? '' }}</div>
        </div>
        <a v-if="u.phone" :href="`tel:${u.phone}`" class="call" @click.stop>📞</a>
      </div>
    </div>

    <el-table v-else v-loading="loading" :data="items" stripe @row-click="open">
      <el-table-column label="姓名" min-width="130">
        <template #default="{ row }">
          <div class="name-cell">
            <UserAvatar :name="row.name" :avatar="row.avatar" :size="32" />
            <span>{{ row.name }}</span>
            <el-tag v-if="row.role === 'ADMIN'" size="small" type="warning">管理员</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="studentNo" label="学号" min-width="120" />
      <el-table-column label="小组" min-width="90">
        <template #default="{ row }">{{ row.group?.name ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="phone" label="电话" min-width="120" />
      <el-table-column prop="qq" label="QQ" min-width="110" />
      <el-table-column prop="dorm" label="宿舍" min-width="110" />
      <el-table-column label="生日" min-width="130">
        <template #default="{ row }">{{ row.birthday?.text ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      :layout="isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
      class="pager"
      @current-change="load"
      @size-change="load"
    />

    <UserDetailDrawer v-model:visible="drawerVisible" :user="selected" />
  </div>
</template>

<style scoped>
.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
}
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 500;
  margin-bottom: 2px;
}
.call {
  font-size: 22px;
  text-decoration: none;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
