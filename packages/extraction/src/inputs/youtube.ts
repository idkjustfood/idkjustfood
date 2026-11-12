import { videoPlatformModule } from "./video.js"

/** YouTube Shorts: youtube.com/shorts/<id>, and youtu.be/<id> share links. */
export const youtube = videoPlatformModule({
  id: "youtube-shorts",
  label: "YouTube Short",
  hosts: ["youtube.com", "youtu.be"],
  isVideoPath: (url) =>
    /^\/shorts\/[\w-]+/.test(url.pathname) ||
    (url.hostname.toLowerCase() === "youtu.be" &&
      /^\/[\w-]+/.test(url.pathname)),
  unsupportedMessage:
    "That YouTube link is not a Short. Only youtube.com/shorts/... links are supported.",
})
