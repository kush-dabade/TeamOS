import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import type { WorkspaceMember } from "../types";

import { WorkspaceMemberRow } from "./workspace-member-row";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const updateRole = vi.fn();
const removeMember = vi.fn();
vi.mock("../hooks/use-update-workspace-member-role", () => ({
  useUpdateWorkspaceMemberRole: () => ({ mutateAsync: updateRole, isPending: false }),
}));
vi.mock("../hooks/use-remove-workspace-member", () => ({
  useRemoveWorkspaceMember: () => ({ mutateAsync: removeMember, isPending: false }),
}));
vi.mock("../hooks/use-transfer-workspace-ownership", () => ({
  useTransferWorkspaceOwnership: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const member: WorkspaceMember = {
  id: "member-1",
  userId: "user-2",
  name: "Grace Hopper",
  email: "grace@example.com",
  image: null,
  role: "MEMBER",
  joinedAt: "2026-10-01T00:00:00.000Z",
};

function renderRow() {
  render(
    <table>
      <tbody>
        <WorkspaceMemberRow
          workspaceId="workspace-1"
          workspaceName="Acme"
          member={member}
          actorRole="OWNER"
        />
      </tbody>
    </table>,
  );
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for Grace Hopper" }), {
    button: 0,
    ctrlKey: false,
  });
}

beforeEach(() => {
  cleanup();
  updateRole.mockReset().mockResolvedValue(undefined);
  removeMember.mockReset().mockResolvedValue(undefined);
  vi.mocked(toast.success).mockReset();
});

// Regression (audit F-20): role changes and removals succeeded silently while
// other workspace actions confirmed with a toast.
describe("WorkspaceMemberRow success feedback", () => {
  it("confirms a role change", async () => {
    renderRow();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Admin" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Grace Hopper is now Admin.");
    });
  });

  it("confirms a removal", async () => {
    renderRow();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove member" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Grace Hopper was removed from the workspace.");
    });
  });

  it("stays quiet when the change fails", async () => {
    updateRole.mockRejectedValue(new Error("nope"));
    renderRow();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Admin" }));

    await waitFor(() => {
      expect(updateRole).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
