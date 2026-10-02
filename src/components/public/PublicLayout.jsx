import { useCallback, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import FloatingShareButton from "./FloatingShareButton";
import ShareModal from "./ShareModal";
import PostDetailModal from "./PostDetailModal";
import ReportModal from "./ReportModal";

/**
 * Shell for every public page: atmosphere, header, modals, footer and the
 * mobile share button. Children get the modal openers through the router
 * outlet context.
 */
export default function PublicLayout() {
  const [shareOpen, setShareOpen] = useState(false);
  const [detailPost, setDetailPost] = useState(null);
  const [reportPost, setReportPost] = useState(null);
  const navigate = useNavigate();

  const openShare = useCallback(() => setShareOpen(true), []);
  const openPost = useCallback((post) => setDetailPost(post), []);
  const closePost = useCallback(() => setDetailPost(null), []);
  const openReport = useCallback((post) => {
    setDetailPost(null);
    setReportPost(post);
  }, []);
  const closeReport = useCallback(() => setReportPost(null), []);

  const backToWall = useCallback(() => {
    setShareOpen(false);
    navigate("/wall");
  }, [navigate]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="app-atmosphere" aria-hidden="true" />

      <SiteHeader onShare={openShare} />

      <main className="flex-1 pt-8 pb-4 sm:pt-10">
        <Outlet context={{ openShare, openPost, openReport }} />
      </main>

      <SiteFooter onShare={openShare} />

      <FloatingShareButton onClick={openShare} />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} onDone={backToWall} />
      <PostDetailModal
        post={detailPost}
        open={Boolean(detailPost)}
        onClose={closePost}
        onReport={openReport}
      />
      <ReportModal post={reportPost} open={Boolean(reportPost)} onClose={closeReport} />
    </div>
  );
}