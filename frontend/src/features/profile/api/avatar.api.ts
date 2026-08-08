import { apiClient } from "@/lib/api";

export async function uploadAvatar(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  await apiClient.post("/users/me/avatar", formData);
}

export async function deleteAvatar(): Promise<void> {
  await apiClient.delete("/users/me/avatar");
}
