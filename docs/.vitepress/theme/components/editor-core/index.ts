/*
 * 精简版入口 — 只导出 SVG 编辑器必需的模块
 * 原 index.ts 的 export * from './plugin/...' 会触发 Rollup 打包所有插件，
 * 其中 FlipPlugin 等依赖 @/language 等 monorepo 别名，导致构建失败。
 */
import Editor from './Editor';

// 只导出核心 Editor 类和接口类型
export default Editor;
export * from './interface/Editor';
