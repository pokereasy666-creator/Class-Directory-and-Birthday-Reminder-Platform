<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { rules as r } from '@/utils/validators';

const auth = useAuthStore();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' });

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    ...r.password(),
    {
      validator: (_rule, value, callback) =>
        value && value === form.oldPassword
          ? callback(new Error('新密码不能与原密码相同'))
          : callback(),
      trigger: 'blur',
    },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) =>
        value === form.newPassword ? callback() : callback(new Error('两次输入的密码不一致')),
      trigger: 'blur',
    },
  ],
};

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  loading.value = true;
  try {
    const { token, user } = await authApi.changePassword(form.oldPassword, form.newPassword);
    // 修改密码后旧 token 失效，换成新 token 继续使用
    auth.setSession(token, user);
    ElMessage.success('密码已修改');
    await router.replace('/');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-card shadow="never" class="card">
    <el-alert
      v-if="auth.user?.mustChangePassword"
      type="warning"
      show-icon
      :closable="false"
      title="你正在使用管理员设置的初始密码，请先修改密码"
      class="alert"
    />
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="submit"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          v-model="form.oldPassword"
          type="password"
          show-password
          autocomplete="current-password"
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          show-password
          placeholder="6~32 位，包含字母和数字"
          autocomplete="new-password"
        />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirm">
        <el-input
          v-model="form.confirm"
          type="password"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading">确认修改</el-button>
    </el-form>
  </el-card>
</template>

<style scoped>
.card {
  max-width: 480px;
}
.alert {
  margin-bottom: 16px;
}
</style>
