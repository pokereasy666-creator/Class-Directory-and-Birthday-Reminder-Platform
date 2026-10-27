<script setup lang="ts">
import type { FormInstance, FormRules, UploadRawFile, UploadRequestOptions } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { profileApi } from '@/api';
import type { BirthdayInput } from '@/api/types';
import BirthdayEditor from '@/components/BirthdayEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import { rules as r } from '@/utils/validators';

const auth = useAuthStore();
const user = auth.user!;
const formRef = ref<FormInstance>();
const saving = ref(false);
const uploading = ref(false);

const form = reactive({
  phone: user.phone ?? '',
  qq: user.qq ?? '',
  email: user.email ?? '',
  dorm: user.dorm ?? '',
  remark: user.remark ?? '',
  emailNotify: user.emailNotify,
  birthday: (user.birthday
    ? {
        calendar: user.birthday.calendar,
        year: user.birthday.year,
        month: user.birthday.month,
        day: user.birthday.day,
        isLeapMonth: user.birthday.isLeapMonth,
      }
    : null) as BirthdayInput | null,
});

const rules: FormRules = {
  phone: r.phone(),
  qq: r.qq(),
  email: r.email(),
  dorm: [{ max: 50, message: '宿舍不能超过 50 个字符', trigger: 'blur' }],
  remark: [{ max: 200, message: '备注不能超过 200 个字符', trigger: 'blur' }],
};

async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    auth.user = await profileApi.update({ ...form });
    ElMessage.success('资料已保存');
  } finally {
    saving.value = false;
  }
}

function beforeUpload(file: UploadRawFile) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.error('只支持 JPG、PNG、WEBP 格式的图片');
    return false;
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片不能超过 2MB');
    return false;
  }
  return true;
}

async function upload(options: UploadRequestOptions) {
  uploading.value = true;
  try {
    const { avatar } = await profileApi.uploadAvatar(options.file);
    auth.user!.avatar = avatar;
    ElMessage.success('头像已更新');
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <el-row :gutter="16">
    <el-col :xs="24" :md="8" class="block">
      <el-card shadow="never" class="side">
        <el-upload
          :show-file-list="false"
          :before-upload="beforeUpload"
          :http-request="upload"
          accept="image/jpeg,image/png,image/webp"
        >
          <div v-loading="uploading" class="avatar-wrap" title="点击更换头像">
            <UserAvatar :name="auth.user!.name" :avatar="auth.user!.avatar" :size="96" />
            <div class="muted">点击更换头像</div>
          </div>
        </el-upload>
        <div class="name">{{ auth.user!.name }}</div>
        <el-descriptions :column="1" size="small" class="readonly">
          <el-descriptions-item label="登录账号">{{ auth.user!.username }}</el-descriptions-item>
          <el-descriptions-item label="学号">{{
            auth.user!.studentNo ?? '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="小组">{{
            auth.user!.group?.name ?? '未分组'
          }}</el-descriptions-item>
          <el-descriptions-item label="身份">{{
            auth.user!.role === 'ADMIN' ? '管理员' : '学生'
          }}</el-descriptions-item>
        </el-descriptions>
        <div class="muted">姓名、学号、小组如需修改请联系班长或班主任</div>
      </el-card>
    </el-col>
    <el-col :xs="24" :md="16" class="block">
      <el-card shadow="never" header="个人资料">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="96px"
          label-position="left"
        >
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" maxlength="11" />
          </el-form-item>
          <el-form-item label="QQ" prop="qq">
            <el-input v-model="form.qq" maxlength="12" />
          </el-form-item>
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" />
          </el-form-item>
          <el-form-item label="宿舍" prop="dorm">
            <el-input v-model="form.dorm" placeholder="如 3号楼 402" maxlength="50" />
          </el-form-item>
          <el-form-item label="生日">
            <BirthdayEditor v-model="form.birthday" />
          </el-form-item>
          <el-form-item label="邮件提醒">
            <el-switch v-model="form.emailNotify" />
            <span class="muted hint">开启后，同学生日时会同时发送邮件（需填写邮箱）</span>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>
  </el-row>
</template>

<style scoped>
.block {
  margin-bottom: 16px;
}
.side {
  text-align: center;
}
.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.name {
  font-size: 20px;
  font-weight: 600;
  margin: 12px 0;
}
.readonly {
  text-align: left;
  margin-bottom: 8px;
}
.hint {
  margin-left: 12px;
}
@media (max-width: 768px) {
  :deep(.el-form-item) {
    flex-direction: column;
    align-items: stretch;
  }
  :deep(.el-form-item__label) {
    justify-content: flex-start;
  }
  .hint {
    margin-left: 0;
    display: block;
  }
}
</style>
