import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import SitesView from "@/views/SitesView.vue";
import SiteCreateView from "@/views/SiteCreateView.vue";
import SiteDetailView from "@/views/SiteDetailView.vue";
import SiteEditView from "@/views/SiteEditView.vue";

/**
 * Application router using HTML5 history. Registered routes cover the dashboard,
 * the site list, site create, and site edit/detail views (which pass their
 * `siteId` route param through as a component prop).
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: DashboardView },
    { path: "/sites", name: "sites", component: SitesView },
    { path: "/sites/new", name: "site-create", component: SiteCreateView },
    {
      path: "/sites/:siteId/edit",
      name: "site-edit",
      component: SiteEditView,
      props: true,
    },
    {
      path: "/sites/:siteId",
      name: "site-detail",
      component: SiteDetailView,
      props: true,
    },
  ],
});
