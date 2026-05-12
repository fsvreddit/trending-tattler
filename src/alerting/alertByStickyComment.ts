import { SettingsValues } from "@devvit/public-api";
import { PostFound } from "../types.js";
import { AppSetting, StickyCommentOption } from "../settings.js";

export async function alertByStickyComment (stickyCommentAction: StickyCommentOption, post: PostFound, settings: SettingsValues) {
    if (stickyCommentAction === StickyCommentOption.AddIfNone) {
        const comments = await post.post.comments.all();
        if (comments.some(comment => comment.isStickied())) {
            return;
        }
    }

    let commentText = settings[AppSetting.ActionStickyCommentContent] as string | undefined;
    if (!commentText) {
        return;
    }

    commentText = commentText.replace("{{feeds}}", post.foundInFeed.map(feed => `/r/${feed}`).join(", "));

    commentText = `${commentText.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${post.post.subredditName}) if you have any questions or concerns.*`;

    const newComment = await post.post.addComment({ text: commentText });
    await newComment.distinguish(true);
    if (settings[AppSetting.ActionStickyCommentLock]) {
        await newComment.lock();
    }
    console.log("Sticky comment left");
}
