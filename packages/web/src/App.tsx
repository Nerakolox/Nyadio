import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { PageTitle } from "./components/PageTitle";
import { PublicLayout } from "./components/PublicLayout";
import { FloatingPlayer } from "./components/player/FloatingPlayer";
import { PlayerProvider } from "./components/player/PlayerProvider";
import { AdminsPage } from "./pages/admin/AdminsPage";
import { ChannelDetailPage } from "./pages/admin/ChannelDetailPage";
import { ChannelsPage } from "./pages/admin/ChannelsPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { SubmissionsPage } from "./pages/admin/SubmissionsPage";
import { TagsPage } from "./pages/admin/TagsPage";
import { ChannelDetailPage as PublicChannelDetailPage } from "./pages/public/ChannelDetailPage";
import { ChannelsPage as PublicChannelsPage } from "./pages/public/ChannelsPage";
import { HomePage } from "./pages/public/HomePage";
import { SubmitPage } from "./pages/public/SubmitPage";
import { TagPage } from "./pages/public/TagPage";

export function App() {
  return (
    <PlayerProvider>
      <PageTitle />
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="channels" element={<PublicChannelsPage />} />
          <Route path="tags/:tag" element={<TagPage />} />
          <Route path="channel/:slug" element={<PublicChannelDetailPage />} />
          <Route path="submit" element={<SubmitPage />} />
        </Route>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/submissions" replace />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/:id" element={<ChannelDetailPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingPlayer />
    </PlayerProvider>
  );
}
