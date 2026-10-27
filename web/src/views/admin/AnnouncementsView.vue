<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { announcementApi } from '@/api';
import type { Announcement } from '@/api/types';
import { confirm } from '@/utils/dialog';
import { formatDateTime } from '@/utils/format';

const items = ref<Announcement[]>([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 20 });

const dialogVisible = ref(false);
const editing = ref<Announcement | null>(null);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ title: '', content: '', pinned: false });
const rules: FormRules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { max: 100, message: '标题不能超过 100 个字符', trigger: 'blur' },
  ],
  content: [
    { required: true, message: '请输入内容', trigger: 'blur' },
    { max: 5000, message: '内容不能超过 5000 个字符', trigger: 'blur' },
  ],
};

async function load() {
  loading.value = true;
  try {
    const res = await announcementApi.list(query);
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function open(a?: Announcement) {
  editing.value = a ?? null;
  Object.assign(form, {
    title: a?.title ?? '',
    content: a?.content ?? '',
    pinned: a?.pinned ?? false,
  });
  dialogVisible.value = true;
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    if (editing.value) {
      await announcementApi.update(editing.value.id, { ...form });
      ElMessage.success('已保存');
    } else {
      await announcementApi.create({ ...form });
      ElMessage.success('已发布，全班同学会收到通知');
    }
    dialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function togglePin(a: Announcement) {
  await announcementApi.update(a.id, { title: a.title, content: a.content, pinned: !a.pinned });
  await load();
}

async function remove(a: Announcement) {
  if (!(await confirm(`确定删除公告"${a.title}"吗？`, '删除公告'))) return;
  await announcementApi.remove(a.id);
  ElMessage.success('已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <span class="spacer" />
      <el-button type="primary" :icon="Plus" @click="open()">发布公告</el-button>
    </div>
    <el-table v-loading="loading" :data="items" stripe>
      <el-table-column label="标题" min-width="220">
        <template #default="{ row }">
          <el-tag v-if="row.pinned" size="small" type="danger">置顶</el-tag>
          {{ row.title }}
        </template>
      </el-table-column>
      <el-table-column label="发布人" width="110">
        <template #default="{ row }">{{ row.author?.name ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="发布时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row as Announcement)">编辑</el-button>
          <el-button link @click="togglePin(row as Announcement)">{{
            row.pinned ? '取消置顶' : '置顶'
          }}</el-button>
          <el-button link type="danger" @click="remove(row as Announcement)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pager"
      @current-change="load"
    />

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑公告' : '发布公告'"
      width="min(640px, 94vw)"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="标题" prop="title"
          ><el-input v-model="form.title" maxlength="100"
        /></el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item><el-checkbox v-model="form.pinned">置顶</el-checkbox></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{
          editing ? '保存' : '发布'
        }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
