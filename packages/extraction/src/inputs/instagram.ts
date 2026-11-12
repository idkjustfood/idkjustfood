import { videoPlatformModule } from "./video.js"

/** Instagram Reels (and video posts): instagram.com/reel/<id>, /reels/<id>, /p/<id>, /tv/<id>. */
export const instagram = videoPlatformModule({
  id: "instagram",
  label: "Instagram reel",
  hosts: ["instagram.com", "instagr.am"],
  isVideoPath: (url) =>
    /^\/(?:[^/]+\/)?(?:reels?|p|tv)\/[\w-]+/i.test(url.pathname),
  unsupportedMessage:
    "That Instagram link is not a reel. Open the reel and copy its link (instagram.com/reel/...).",
})
