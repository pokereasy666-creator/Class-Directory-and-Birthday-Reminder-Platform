<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { adminApi, groupApi, type AdminUserForm } from '@/api';
import type { AdminStats, BirthdayInput, Group, Profile, Role, UserStatus } from '@/api/types';
import BirthdayEditor from '@/components/BirthdayEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import { alertLines, confirm, prompt } from '@/utils/dialog';
import { formatDateTime, randomPassword } from '@/utils/format';
import { PATTERNS, rules as r } from '@/utils/validators';

const emit = defineEmits<{ 'pending-changed': [] }>();
const auth = useAuthStore();
const route = useRoute();

const STATUS_TEXT: Record<UserStatus, { label: string; type: 'warning' | 'success' | 'info' }> = {
  PENDING: { label: '待审核', type: 'warning' },
  ACTIVE: { label: '正常', type: 'success' },
  DISABLED: { label: '已禁用', type: 'info' },
};

const groups = ref<Group[]>([]);
const stats = ref<AdminStats | null>(null);
const items = ref<Profile[]>([]);
const total = ref(0);
const loading = ref(false);
const initialStatus = route.query.status as UserStatus | undefined;
const query = reactive({
  status: (initialStatus && initialStatus in STATUS_TEXT ? initialStatus : '') as UserStatus | '',
  keyword: '',
  groupId: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

async function load() {
  loading.value = true;
  try {
    const [res, s] = await Promise.all([
      adminApi.users({
        status: query.status || undefined,
        keyword: query.keyword.trim() || undefined,
        groupId: query.groupId,
        page: query.page,
        pageSize: query.pageSize,
      }),
      adminApi.stats(),
    ]);
    items.value = res.items;
    total.value = res.total;
    stats.value = s;
  } finally {
    loading.value = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [query.status, query.keyword, query.groupId],
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      query.page = 1;
      void load();
    }, 300);
  },
);

async function afterChange(message: string) {
  ElMessage.success(message);
  await load();
  emit('pending-changed');
}

async function approve(u: Profile) {
  await adminApi.setStatus(u.id, 'ACTIVE');
  await afterChange(`已通过 ${u.name} 的注册申请`);
}

async function reject(u: Profile) {
  if (!(await confirm(`驳回后将删除 ${u.name}（${u.studentNo}）的注册信息，确定吗？`, '驳回注册')))
    return;
  await adminApi.removeUser(u.id);
  await afterChange('已驳回');
}

async function toggleStatus(u: Profile) {
  const disable = u.status === 'ACTIVE';
  if (
    disable &&
    !(await confirm(`禁用后 ${u.name} 将无法登录，并会被立即踢下线，确定吗？`, '禁用账号'))
  ) {
    return;
  }
  await adminApi.setStatus(u.id, disable ? 'DISABLED' : 'ACTIVE');
  await afterChange(disable ? '已禁用' : '已启用');
}

async function remove(u: Profile) {
  const ok = await confirm(
    `将永久删除 ${u.name} 的账号和通讯录信息，且无法恢复，确定吗？`,
    '删除学生',
    {
      type: 'error',
      confirmButtonText: '删除',
    },
  );
  if (!ok) return;
  await adminApi.removeUser(u.id);
  await afterChange('已删除');
}

async function resetPassword(u: Profile) {
  const value = await prompt(`为 ${u.name} 设置新的初始密码：`, '重置密码', {
    inputValue: randomPassword(),
    inputPattern: PATTERNS.password,
    inputErrorMessage: '密码应为 6~32 位，且同时包含字母和数字',
  });
  if (!value) return;
  await adminApi.resetPassword(u.id, value);
  await alertLines([`新密码：${value}`, `请告知 ${u.name}，登录后需要修改密码。`], '重置成功');
}

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const editing = ref<Profile | null>(null);
const saving = ref(false);
const formRef = ref<FormInstance>();
const emptyForm = () => ({
  name: '',
  studentNo: '',
  username: '',
  password: '',
  role: 'STUDENT' as Role,
  groupId: null as number | null,
  phone: '',
  qq: '',
  email: '',
  dorm: '',
  remark: '',
  birthday: null as BirthdayInput | null,
});
const form = reactive(emptyForm());
const isSelf = computed(() => editing.value?.id === auth.user?.id);

const formRules = computed<FormRules>(() => ({
  name: r.name(),
  studentNo: r.studentNo(form.role === 'STUDENT'),
  username: r.username(),
  password: editing.value ? [] : r.password(),
  phone: r.phone(),
  qq: r.qq(),
  email: r.email(),
}));

function openCreate() {
  editing.value = null;
  Object.assign(form, emptyForm(), { password: randomPassword() });
  dialogVisible.value = true;
}

function openEdit(u: Profile) {
  editing.value = u;
  Object.assign(form, emptyForm(), {
    name: u.name,
    studentNo: u.studentNo ?? '',
    role: u.role,
    groupId: u.group?.id ?? null,
    phone: u.phone ?? '',
    qq: u.qq ?? '',
    email: u.email ?? '',
    dorm: u.dorm ?? '',
    remark: u.remark ?? '',
    birthday: u.birthday
      ? {
          calendar: u.birthday.calendar,
          year: u.birthday.year,
          month: u.birthday.month,
          day: u.birthday.day,
          isLeapMonth: u.birthday.isLeapMonth,
        }
      : null,
  });
  dialogVisible.value = true;
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const { username, password, ...fields } = form;
    const data: AdminUserForm = { ...fields };
    if (editing.value) {
      if (isSelf.value) delete data.role;
      await adminApi.updateUser(editing.value.id, data);
      dialogVisible.value = false;
      await afterChange('已保存');
    } else {
      await adminApi.createUser({ ...data, username: username || null, password });
      dialogVisible.value = false;
      await afterChange('已创建');
      await alertLines(
        [
          `登录账号：${username || fields.studentNo}`,
          `初始密码：${password}`,
          '首次登录后需要修改密码。',
        ],
        '账号已创建',
      );
    }
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  void load();
  groups.value = await groupApi.list();
});
</script>

<template>
  <div>
    <el-radio-group v-model="query.status" class="status-tabs">
      <el-radio-button value="">全部 {{ stats?.total ?? '' }}</el-radio-button>
      <el-radio-button value="PENDING">待审核 {{ stats?.pending ?? '' }}</el-radio-button>
      <el-radio-button value="ACTIVE">正常 {{ stats?.active ?? '' }}</el-radio-button>
      <el-radio-button value="DISABLED">已禁用 {{ stats?.disabled ?? '' }}</el-radio-button>
    </el-radio-group>

    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        :prefix-icon="Search"
        placeholder="姓名 / 学号 / 账号"
        clearable
        style="width: 220px"
      />
      <el-select v-model="query.groupId" placeholder="全部小组" clearable style="width: 140px">
        <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
      </el-select>
      <span class="spacer" />
      <el-button type="primary" :icon="Plus" @click="openCreate">新增账号</el-button>
    </div>

    <el-table v-loading="loading" :data="items" stripe>
      <el-table-column label="姓名" min-width="140" fixed>
        <template #default="{ row }">
          <div class="name-cell">
            <UserAvatar :name="row.name" :avatar="row.avatar" :size="28" />
            {{ row.name }}
            <el-tag v-if="row.role === 'ADMIN'" size="small" type="warning">管理员</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="studentNo" label="学号" min-width="120" />
      <el-table-column prop="username" label="登录账号" min-width="120" />
      <el-table-column label="小组" min-width="80">
        <template #default="{ row }">{{ row.group?.name ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="phone" label="手机" min-width="120" />
      <el-table-column label="状态" min-width="90">
        <template #default="{ row }">
          <el-tag :type="STATUS_TEXT[row.status as UserStatus].type" size="small">
            {{ STATUS_TEXT[row.status as UserStatus].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="140">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="最近登录" min-width="140">
        <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="260" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'PENDING'">
            <el-button link type="success" @click="approve(row as Profile)">通过</el-button>
            <el-button link type="danger" @click="reject(row as Profile)">驳回</el-button>
            <el-button link type="primary" @click="openEdit(row as Profile)">编辑</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="openEdit(row as Profile)">编辑</el-button>
            <template v-if="row.id !== auth.user?.id">
              <el-button
                link
                :type="row.status === 'ACTIVE' ? 'warning' : 'success'"
                @click="toggleStatus(row as Profile)"
              >
                {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="primary" @click="resetPassword(row as Profile)"
                >重置密码</el-button
              >
              <el-button link type="danger" @click="remove(row as Profile)">删除</el-button>
            </template>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="pager"
      @current-change="load"
      @size-change="load"
    />

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? `编辑 - ${editing.name}` : '新增账号'"
      width="min(620px, 94vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="身份" prop="role">
          <el-radio-group v-model="form.role" :disabled="isSelf">
            <el-radio-button value="STUDENT">学生</el-radio-button>
            <el-radio-button value="ADMIN">管理员（班长/班主任）</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="学号" prop="studentNo">
          <el-input
            v-model="form.studentNo"
            :placeholder="form.role === 'ADMIN' ? '班主任可不填' : ''"
          />
        </el-form-item>
        <template v-if="!editing">
          <el-form-item label="登录账号" prop="username">
            <el-input v-model="form.username" placeholder="不填则使用学号登录" />
          </el-form-item>
          <el-form-item label="初始密码" prop="password">
            <el-input v-model="form.password">
              <template #append>
                <el-button @click="form.password = randomPassword()">随机生成</el-button>
              </template>
            </el-input>
          </el-form-item>
        </template>
        <el-form-item label="小组">
          <el-select v-model="form.groupId" placeholder="未分组" clearable>
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号" prop="phone"
          ><el-input v-model="form.phone" maxlength="11"
        /></el-form-item>
        <el-form-item label="QQ" prop="qq"
          ><el-input v-model="form.qq" maxlength="12"
        /></el-form-item>
        <el-form-item label="邮箱" prop="email"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="宿舍"><el-input v-model="form.dorm" maxlength="50" /></el-form-item>
        <el-form-item label="生日"><BirthdayEditor v-model="form.birthday" /></el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.status-tabs {
  margin-bottom: 16px;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
