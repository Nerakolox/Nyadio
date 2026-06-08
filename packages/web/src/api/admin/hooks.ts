import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type {
  AdminChannel,
  AdminRole,
  AdminSubmissionList,
  AdminTag,
  AdminUser,
  AppConfigItem,
  AppConfigKey,
  ChannelRuntime,
  Protocol,
  SourceHistoryItem,
  SubmissionStatus
} from "./types";

export function useAdminChannels() {
  return useQuery({
    queryKey: ["admin", "channels"],
    queryFn: () => api<AdminChannel[]>("/admin/channels")
  });
}

export function useChannelRuntime(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "channels", id, "runtime"],
    queryFn: () => api<ChannelRuntime>(`/admin/channels/${id}/runtime`),
    enabled: Boolean(id),
    refetchInterval: 10000
  });
}

export function useSourceHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "channels", id, "source-history"],
    queryFn: () => api<SourceHistoryItem[]>(`/admin/channels/${id}/source-history`),
    enabled: Boolean(id)
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      slug: string;
      name: string;
      description?: string;
      sourceUrl: string;
      sourceProtocol: Protocol;
      tagIds: string[];
      featured: boolean;
    }) => api<AdminChannel>("/admin/channels", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "channels"] })
  });
}

export function useUpdateChannel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; featured: boolean; tagIds: string[] }) =>
      api<AdminChannel>(`/admin/channels/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "channels"] })
  });
}

export function useSetChannelStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) =>
      api<{ ok: true }>(`/admin/channels/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "channels"] })
  });
}

export function useRuntimeAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "stop" | "reset-error") =>
      api<{ ok: true }>(`/admin/channels/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "channels", id, "runtime"] });
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
    }
  });
}

export function useAdminTags() {
  return useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => api<AdminTag[]>("/admin/tags")
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<AdminTag>("/admin/tags", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tags"] })
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<AdminTag>(`/admin/tags/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tags"] })
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/admin/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tags"] })
  });
}

export function useAdminSubmissions(status: SubmissionStatus, page: number, limit = 20) {
  return useQuery({
    queryKey: ["admin", "submissions", status, page, limit],
    queryFn: () => api<AdminSubmissionList>(`/admin/submissions?status=${status}&page=${page}&limit=${limit}`)
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body
    }: {
      id: string;
      body:
        | { action: "approve"; channelId: string; protocol?: Protocol; reviewNote?: string | null }
        | {
            action: "approve_as_new";
            newChannel: {
              slug: string;
              name: string;
              description?: string | null;
              tagIds: string[];
              featured: boolean;
            };
            protocol?: Protocol;
            reviewNote?: string | null;
          }
        | { action: "reject"; reviewNote?: string | null };
    }) => api<{ ok: true; channelId?: string }>(`/admin/submissions/${id}/review`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "submissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "channels"] });
    }
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "admins"],
    queryFn: () => api<AdminUser[]>("/admin/admins")
  });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string; role: AdminRole }) =>
      api<AdminUser>("/admin/admins", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] })
  });
}

export function useSetAdminStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      api<{ ok: true }>(`/admin/admins/${id}/status`, { method: "PATCH", body: JSON.stringify({ disabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] })
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api<AppConfigItem[]>("/admin/settings")
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Record<AppConfigKey, number>>) =>
      api<AppConfigItem[]>("/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] })
  });
}
