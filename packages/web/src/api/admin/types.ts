export type Protocol = "HLS" | "ICECAST" | "HTTP_PUSH";
export type ChannelStatus = "ACTIVE" | "INACTIVE";
export type RuntimeState = "idle" | "starting" | "running" | "error" | "inactive";
export type AdminRole = "SUPERADMIN" | "MODERATOR";

export interface AdminTag {
  id: string;
  name: string;
  channelCount: number;
}

export interface ChannelRuntime {
  state: RuntimeState;
  retryCount: number;
  lastHeartbeat: string | null;
  listenerCount: number;
  hlsPollerCount: number;
  idleSecondsRemaining: number | null;
}

export interface AdminChannel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  featured: boolean;
  status: ChannelStatus;
  tags: AdminTag[];
  source: { protocol: Protocol; url: string } | null;
  runtime: ChannelRuntime;
}

export interface SourceHistoryItem {
  id: string;
  protocol: Protocol;
  url: string;
  replacedBy: string | null;
  createdAt: string;
}

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminSubmission {
  id: string;
  url: string;
  protocol: Protocol;
  targetChannelId: string | null;
  targetChannel: { id: string; slug: string; name: string } | null;
  suggestedSlug: string | null;
  suggestedName: string | null;
  note: string | null;
  contact: string | null;
  status: SubmissionStatus;
  createdAt: string;
  reviewer: { id: string; username: string; role: AdminRole } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface AdminSubmissionList {
  total: number;
  page: number;
  limit: number;
  items: AdminSubmission[];
}

export interface AdminUser {
  id: string;
  username: string;
  role: AdminRole;
  disabled: boolean;
  createdAt: string;
}

export type AppConfigKey =
  | "MAX_ACTIVE_CHANNELS"
  | "ALWAYS_ON_ACTIVE_CHANNELS"
  | "HLS_SEGMENT_DURATION"
  | "HLS_WINDOW_SIZE"
  | "IDLE_TIMEOUT_MS"
  | "MAX_RETRY"
  | "SUBMISSION_RATE_LIMIT";

export interface AppConfigItem {
  key: AppConfigKey;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  updatedAt: string | null;
}
