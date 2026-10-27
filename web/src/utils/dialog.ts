import { ElMessageBox, type ElMessageBoxOptions } from 'element-plus';
import { h } from 'vue';

/** 确认框：点"确定"返回 true，取消或关闭返回 false（不抛异常） */
export function confirm(message: string, title: string, options: ElMessageBoxOptions = {}) {
  return ElMessageBox.confirm(message, title, { type: 'warning', ...options })
    .then(() => true)
    .catch(() => false);
}

/** 输入框：返回输入值，取消返回 null */
export function prompt(message: string, title: string, options: ElMessageBoxOptions = {}) {
  return ElMessageBox.prompt(message, title, options)
    .then(({ value }) => value)
    .catch(() => null);
}

/** 多行文本提示框（保留换行） */
export function alertLines(lines: string[], title: string) {
  return ElMessageBox.alert(h('div', { style: 'white-space: pre-line' }, lines.join('\n')), title, {
    type: 'success',
  }).catch(() => undefined);
}
