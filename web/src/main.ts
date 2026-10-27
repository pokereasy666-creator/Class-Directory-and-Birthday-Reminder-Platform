import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { ApiError } from './api/http';
import App from './App.vue';
import router from './router';
import './styles/main.css';

dayjs.locale('zh-cn');

const app = createApp(App);
// 接口错误已在请求层统一提示，这里不再当作未处理异常
app.config.errorHandler = (err) => {
  if (!(err instanceof ApiError)) console.error(err);
};
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount('#app');
