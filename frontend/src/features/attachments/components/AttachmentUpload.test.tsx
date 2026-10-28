import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { DEMO_ATTACHMENT_MAX_FILE_SIZE } from "../lib/attachment-config";
import { AttachmentUpload } from "./AttachmentUpload";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function fileOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], "notes.txt", { type: "text/plain" });
}

beforeEach(() => {
  cleanup();
  vi.mocked(toast.error).mockReset();
});

// Regression (audit F-22): demo users were told "Max 10MB" while the server
// rejects anything over 2MB for them.
describe("AttachmentUpload size limit", () => {
  it("shows the standard 10MB limit by default", () => {
    render(<AttachmentUpload onUpload={vi.fn()} isUploading={false} />);

    expect(screen.getByText(/Max 10MB/)).toBeTruthy();
  });

  it("shows and enforces the demo limit when given one", () => {
    const onUpload = vi.fn();
    render(
      <AttachmentUpload
        onUpload={onUpload}
        isUploading={false}
        maxFileSize={DEMO_ATTACHMENT_MAX_FILE_SIZE}
      />,
    );

    expect(screen.getByText(/Max 2MB/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Upload attachment files"), {
      target: { files: [fileOfSize(DEMO_ATTACHMENT_MAX_FILE_SIZE + 1)] },
    });

    expect(onUpload).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("2MB or smaller"));
  });
});
