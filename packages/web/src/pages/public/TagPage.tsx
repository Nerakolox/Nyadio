import { useParams } from "react-router-dom";
import { usePublicChannels, usePublicTags } from "../../api/public/hooks";
import { ChannelCard } from "../../components/ChannelCard";
import { CardGridSkeleton, EmptyState, PublicListFrame } from "./ChannelsPage";

export function TagPage() {
  const params = useParams();
  const tag = params.tag ? decodeURIComponent(params.tag) : "";
  const tags = usePublicTags();
  const channels = usePublicChannels({ tag });

  return (
    <PublicListFrame
      title={`标签：${tag || "未知"}`}
      description="这里只显示带有该标签的公开频道。标签不存在时不会跳转到 404。"
      tags={tags.data ?? []}
      tagsLoading={tags.isLoading}
    >
      {channels.isLoading ? (
        <CardGridSkeleton />
      ) : (channels.data ?? []).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.data?.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <EmptyState text="该标签下暂无频道。" />
      )}
    </PublicListFrame>
  );
}
