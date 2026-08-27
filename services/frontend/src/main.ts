import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router/index";
import "./style.css";

/**
 * Frontend entrypoint: creates the Vue app, installs the Pinia store and the
 * application router, then mounts it to the `#app` element.
 */
createApp(App).use(createPinia()).use(router).mount("#app");
