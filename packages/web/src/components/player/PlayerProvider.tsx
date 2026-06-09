import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PlayState, PublicChannelDetail } from "../../api/public/types";

export type PlaybackPhase = "idle" | "connecting" | "playing" | "paused" | "blocked" | "error";

export interface PlaybackStatus {
  phase: PlaybackPhase;
  message: string | null;
}

export type PlayerChannel = Pick<PublicChannelDetail, "id" | "slug" | "name" | "playState" | "outputs">;

interface PlayerContextValue extends PlaybackStatus {
  current: PlayerChannel | null;
  error: string | null;
  volume: number;
  muted: boolean;
  isCurrentChannel: (channel: PlayerChannel) => boolean;
  playChannel: (channel: PlayerChannel) => Promise<void>;
  toggleChannel: (channel: PlayerChannel) => Promise<void>;
  togglePlayback: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<PlayerChannel | null>(null);
  const phaseRef = useRef<PlaybackPhase>("idle");
  const playRequestedRef = useRef(false);
  const playbackRunRef = useRef(0);
  const currentPlaybackUrlRef = useRef<string | null>(null);
  const suppressAudioEventsRef = useRef(false);
  const volumeRef = useRef(35);
  const mutedRef = useRef(false);

  const [current, setCurrentState] = useState<PlayerChannel | null>(null);
  const [status, setStatusState] = useState<PlaybackStatus>({ phase: "idle", message: null });
  const [error, setError] = useState<string | null>(null);
  const [volumeState, setVolumeState] = useState(35);
  const [mutedState, setMutedState] = useState(false);

  const setCurrent = useCallback((channel: PlayerChannel | null) => {
    currentRef.current = channel;
    setCurrentState(channel);
  }, []);

  const setStatus = useCallback((next: PlaybackStatus) => {
    phaseRef.current = next.phase;
    setStatusState(next);
  }, []);

  const applyAudioVolume = useCallback((audio: HTMLAudioElement) => {
    audio.volume = volumeRef.current / 100;
    audio.muted = mutedRef.current || volumeRef.current === 0;
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "none";
      applyAudioVolume(audio);
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [applyAudioVolume]);

  const teardownAudio = useCallback((options: { keepRunId?: boolean } = {}) => {
    if (!options.keepRunId) playbackRunRef.current += 1;
    currentPlaybackUrlRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;

    suppressAudioEventsRef.current = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    window.setTimeout(() => {
      suppressAudioEventsRef.current = false;
    }, 0);
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentRef.current) return;

    audio.pause();
    if (phaseRef.current !== "error") {
      setStatus({ phase: "paused", message: "播放已暂停。" });
    }
  }, [setStatus]);

  const stop = useCallback(() => {
    playRequestedRef.current = false;
    teardownAudio();
    setCurrent(null);
    setError(null);
    setStatus({ phase: "idle", message: null });
  }, [setCurrent, setStatus, teardownAudio]);

  const resumeCurrentAudio = useCallback(async () => {
    const audio = ensureAudio();
    setStatus({ phase: "connecting", message: "正在恢复播放..." });

    try {
      await audio.play();
      setError(null);
      setStatus({ phase: "playing", message: null });
    } catch {
      const message = "浏览器拦截了播放，请再次点击播放按钮。";
      setError(message);
      setStatus({ phase: "blocked", message });
    }
  }, [ensureAudio, setStatus]);

  const playChannel = useCallback(
    async (channel: PlayerChannel) => {
      const unavailable = isUnavailable(channel.playState);
      const sameStream = currentPlaybackUrlRef.current === channel.outputs.stream;

      playRequestedRef.current = true;
      setCurrent(channel);
      setError(null);

      if (unavailable) {
        const message = "频道当前不可用，后端未能启动音频流。";
        teardownAudio();
        setError(message);
        setStatus({ phase: "error", message });
        return;
      }

      if (sameStream && audioRef.current?.src) {
        await resumeCurrentAudio();
        return;
      }

      const runId = playbackRunRef.current + 1;
      playbackRunRef.current = runId;
      teardownAudio({ keepRunId: true });
      currentPlaybackUrlRef.current = channel.outputs.stream;
      setStatus({ phase: "connecting", message: "正在连接 AAC 直连流..." });

      const audio = ensureAudio();
      audio.src = channel.outputs.stream;
      applyAudioVolume(audio);
      audio.load();

      try {
        await audio.play();
        if (playbackRunRef.current !== runId) return;
        setError(null);
        setStatus({ phase: "playing", message: null });
      } catch {
        if (playbackRunRef.current !== runId) return;
        const message = "浏览器拦截了自动播放，请点击播放器上的播放按钮。";
        setError(message);
        setStatus({ phase: "blocked", message });
      }
    },
    [applyAudioVolume, ensureAudio, resumeCurrentAudio, setCurrent, setStatus, teardownAudio]
  );

  const toggleChannel = useCallback(
    async (channel: PlayerChannel) => {
      const sameChannel = currentRef.current?.id === channel.id;
      if (sameChannel && phaseRef.current === "playing") {
        pause();
        return;
      }
      await playChannel(channel);
    },
    [pause, playChannel]
  );

  const togglePlayback = useCallback(async () => {
    const channel = currentRef.current;
    if (!channel) return;

    if (phaseRef.current === "playing") {
      pause();
      return;
    }

    await playChannel(channel);
  }, [pause, playChannel]);

  const setVolume = useCallback(
    (nextVolume: number) => {
      const next = Math.max(0, Math.min(100, nextVolume));
      volumeRef.current = next;
      setVolumeState(next);
      if (next > 0) {
        mutedRef.current = false;
        setMutedState(false);
      }
      const audio = ensureAudio();
      applyAudioVolume(audio);
    },
    [applyAudioVolume, ensureAudio]
  );

  const setMuted = useCallback(
    (nextMuted: boolean) => {
      mutedRef.current = nextMuted;
      setMutedState(nextMuted);
      const audio = ensureAudio();
      applyAudioVolume(audio);
    },
    [applyAudioVolume, ensureAudio]
  );

  const isCurrentChannel = useCallback((channel: PlayerChannel) => currentRef.current?.id === channel.id, []);

  useEffect(() => {
    const audio = ensureAudio();

    const handlePlay = () => {
      if (playRequestedRef.current) setStatus({ phase: "playing", message: null });
    };

    const handlePause = () => {
      if (suppressAudioEventsRef.current || !playRequestedRef.current || phaseRef.current === "error") return;
      if (currentRef.current) setStatus({ phase: "paused", message: "播放已暂停。" });
    };

    const handleError = () => {
      if (suppressAudioEventsRef.current || !playRequestedRef.current || phaseRef.current === "error") return;
      const message = "AAC 直连流加载失败，请重试或复制输出地址到外部播放器。";
      currentPlaybackUrlRef.current = null;
      setError(message);
      setStatus({ phase: "error", message });
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      playRequestedRef.current = false;
      teardownAudio();
    };
  }, [ensureAudio, setStatus, teardownAudio]);

  useEffect(() => {
    document.body.classList.toggle("nya-has-floating-player", current !== null);
    return () => document.body.classList.remove("nya-has-floating-player");
  }, [current]);

  return (
    <PlayerContext.Provider
      value={{
        current,
        phase: status.phase,
        message: status.message,
        error,
        volume: volumeState,
        muted: mutedState,
        isCurrentChannel,
        playChannel,
        toggleChannel,
        togglePlayback,
        pause,
        stop,
        setVolume,
        setMuted
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}

function isUnavailable(state: PlayState): boolean {
  return state === "unavailable" || state === "inactive";
}
