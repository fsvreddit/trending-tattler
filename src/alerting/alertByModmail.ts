import { TriggerContext } from "@devvit/public-api";
import { PostFound } from "../types.js";

export async function alertByModmail (posts: PostFound[], context: TriggerContext) {
    if (posts.length === 0) {
        return;
    }

    let message = "Here are the posts that are newly showing in trending feeds:\n\n";

    for (const post of posts) {
        message += `* [${post.post.title}](${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
    }

    await context.reddit.modMail.createModInboxConversation({
        subredditId: context.subredditId,
        subject: "Notification of posts on trending feeds",
        bodyMarkdown: message,
    });

    console.log("Modmail sent");
}
