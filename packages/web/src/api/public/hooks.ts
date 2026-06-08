import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { Protocol, PublicChannel, PublicChannelDetail, PublicTag, SubmissionResult } from "./types";

export function usePublicChannels(options: { featured?: boolean; tag?: string } = {}) {
  const search = new URLSearchParams();
  if (options.featured) search.set("featured", "true");
  if (options.tag) search.set("tag", options.tag);
  const query = search.toString();

  return useQuery({
    queryKey: ["public", "channels", options],
    queryFn: () => api<PublicChannel[]>(`/api/channels${query ? `?${query}` : ""}`),
    refetchInterval: 30000
  });
}

export function usePublicChannel(slug: string | undefined) {
  return useQuery({
    queryKey: ["public", "channels", slug],
    queryFn: () => api<PublicChannelDetail>(`/api/channels/${slug}`),
    enabled: Boolean(slug),
    refetchInterval: 15000
  });
}

export function usePublicTags() {
  return useQuery({
    queryKey: ["public", "tags"],
    queryFn: () => api<PublicTag[]>("/api/tags"),
    refetchInterval: 30000
  });
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: (body: {
      url: string;
      protocol: Protocol;
      targetChannelId?: string | null;
      suggestedSlug?: string | null;
      suggestedName?: string | null;
      note?: string | null;
      contact?: string | null;
    }) => api<SubmissionResult>("/api/submissions", { method: "POST", body: JSON.stringify(body) })
  });
}
