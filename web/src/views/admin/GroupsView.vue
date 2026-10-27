<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { groupApi } from '@/api';
import type { Group } from '@/api/types';
import { confirm } from '@/utils/dialog';

const groups = ref<Group[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editing = ref<Group | null>(null);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ name: '', sort: 0 });
const rules: FormRules = {
  name: [
    { required: true, message: '请输入小组名称', trigger: 'blur' },
    { max: 30, message: '不能超过 30 个字符', trigger: 'blur' },
  ],
};

async function load() {
  loading.value = true;
  try {
    groups.value = await groupApi.list();
  } finally {
    loading.value = false;
  }
}

function open(g?: Group) {
  editing.value = g ?? null;
  form.name = g?.name ?? '';
  form.sort = g?.sort ?? groups.value.length + 1;
  dialogVisible.value = true;
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    if (editing.value) await groupApi.update(editing.value.id, { ...form });
    else await groupApi.create({ ...form });
    dialogVisible.value = false;
    ElMessage.success('已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(g: Group) {
  const ok = await confirm(
    `删除"${g.name}"后，组内 ${g.memberCount} 名同学将变为未分组，确定吗？`,
    '删除小组',
  );
  if (!ok) return;
  await groupApi.remove(g.id);
  ElMessage.success('已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <span class="muted">在"用户管理"中编辑学生即可调整其所在小组</span>
      <span class="spacer" />
      <el-button type="primary" :icon="Plus" @click="open()">新增小组</el-button>
    </div>
    <el-table v-loading="loading" :data="groups" stripe>
      <el-table-column prop="name" label="小组名称" min-width="140" />
      <el-table-column prop="memberCount" label="人数" width="90" />
      <el-table-column prop="sort" label="排序" width="90" />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row as Group)">编辑</el-button>
          <el-button link type="danger" @click="remove(row as Group)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑小组' : '新增小组'"
      width="min(420px, 92vw)"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        @submit.prevent="submit"
      >
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="form.sort" :min="0" :max="9999"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
