import { reddit } from "@devvit/web/server";
import { PostFound } from "../types.js";

export async function alertByReport (post: PostFound) {
    await reddit.report(post.post, { reason: `This post is trending! It is currently in these feeds: ${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")}` });
    console.log("Post reported");
}
