import { cleanup, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { PageLayout } from "./PageLayout";

// SidebarProvider's mobile check uses matchMedia, which jsdom doesn't have.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  cleanup();
});

// Regression (audit F-18): pages rendered a <main> inside the app shell's own
// <main>, giving assistive technology two nested main landmarks.
describe("PageLayout", () => {
  it("leaves exactly one main landmark inside the app shell", () => {
    render(
      <SidebarProvider>
        <SidebarInset>
          <PageLayout>Page content</PageLayout>
        </SidebarInset>
      </SidebarProvider>,
    );

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main").textContent).toContain("Page content");
  });
});
