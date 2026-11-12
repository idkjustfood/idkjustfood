import { videoPlatformModule } from "./video.js"

/** TikTok videos: tiktok.com/@user/video/<id>, and the short links vm.tiktok.com and tiktok.com/t/<code>. */
export const tiktok = videoPlatformModule({
  id: "tiktok",
  label: "TikTok",
  hosts: ["tiktok.com"],
  isVideoPath: (url) =>
    /^\/@[^/]+\/video\/\d+/.test(url.pathname) ||
    /^\/(?:t|v)\/[\w-]+/.test(url.pathname) ||
    // vm.tiktok.com/<code> and vt.tiktok.com/<code>
    (/^v[mt]\.tiktok\.com$/i.test(url.hostname) &&
      /^\/[\w-]+/.test(url.pathname)),
  unsupportedMessage:
    "That TikTok link is not a video. Open the video, tap Share and copy its link.",
})
