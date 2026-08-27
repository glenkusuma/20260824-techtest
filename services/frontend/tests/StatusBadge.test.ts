import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StatusBadge from "@/components/StatusBadge.vue";

describe("StatusBadge", () => {
  it("renders warning state clearly", () => {
    const wrapper = mount(StatusBadge, { props: { status: "warning" } });
    expect(wrapper.text()).toContain("Needs attention");
    expect(wrapper.html()).toContain("amber");
  });
});
