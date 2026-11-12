import { createApp } from "vue";
import { createPinia } from "pinia";
import "./style.css";

// 同一入口按 hash 路由：主窗口 #/ 主页，设置窗口 #/settings，日历窗口 #/calendar
const hash = window.location.hash;

if (hash.startsWith("#/settings")) {
  import("./SettingsApp.vue")
    .then(({ default: App }) => {
      createApp(App).use(createPinia()).mount("#app");
    })
    .catch((e) => console.error("设置窗口加载失败：", e));
} else if (hash.startsWith("#/calendar")) {
  import("./CalendarApp.vue")
    .then(({ default: App }) => {
      createApp(App).use(createPinia()).mount("#app");
    })
    .catch((e) => console.error("日历窗口加载失败：", e));
} else {
  import("./App.vue")
    .then(({ default: App }) => {
      createApp(App).use(createPinia()).mount("#app");
    })
    .catch((e) => console.error("主窗口加载失败：", e));
}
