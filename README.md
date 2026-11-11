# 💰 上班鼓励器

把抽象的「月薪」拆成可感知的「秒薪」，让打工人实时看到自己在赚钱。

基于 **Tauri 2 + Vue 3 + TypeScript + Pinia**，纯前端计算，无任何网络请求，设置保存在本地 localStorage。

## 功能

- **实时计薪**：大字号 4 位小数「今日已赚」逐秒跳动
- **下班倒计时**：上班中 / 午休中 / 已下班 / 休息日状态自动切换，精确到秒
- **今日进度条**：已赚 / 应赚百分比实时填充
- **本月累计**：已过工作日薪资汇总 + 发薪日倒计时
- **节假日倒计时**：下一个休息日 / 法定节假日 / 发薪日
- **鼓励语录**：打字机效果轮播打气文案
- **个性化设置**：月薪/年薪/时薪三种模式，双休/单休/大小周，自定义上下班与午休时间（支持跨午夜夜班），发薪日

内置 2026 年中国法定节假日与调休数据（`src/utils/holidays.ts`，如有官方微调可直接改表）。

## 开发

```bash
npm install          # 安装前端依赖（首次需 Rust 工具链 + Tauri 2 系统依赖）
npm run tauri dev    # 开发模式（自动起 Vite + 打开桌面窗口）
npm run tauri build  # 打包 Windows 安装包（NSIS）
```

前置要求：Node 18+、Rust（含 MSVC 工具链）、WebView2（Win10/11 一般自带）。

## 结构

```
src/                  前端（Vue）
  stores/             Pinia：设置持久化 + 全局秒级时钟
  utils/salary.ts     薪资计算引擎（班次/午休/夜班/调休/月累计）
  utils/holidays.ts   法定节假日数据
  components/         各卡片组件
src-tauri/            Tauri 2 壳（无自定义命令，纯 WebView）
scripts/gen-icon.mjs  应用图标生成脚本
```
