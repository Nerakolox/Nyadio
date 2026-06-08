export type PlayState = "live" | "preparing" | "unavailable" | "inactive";
export type Protocol = "HLS" | "ICECAST" | "HTTP_PUSH";

export interface PublicChannel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  featured: boolean;
  tags: string[];
  online: boolean;
  playState: PlayState;
  listenerCount: number;
}

export interface PublicChannelDetail extends PublicChannel {
  source: {
    protocol: Protocol;
    url: string;
  } | null;
  outputs: {
    hls: string;
    stream: string;
  };
}

export interface PublicTag {
  id: string;
  name: string;
  channelCount: number;
}

export interface SubmissionResult {
  id: string;
  status: "PENDING";
  createdAt: string;
}
