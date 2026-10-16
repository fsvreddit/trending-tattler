import { context, reddit } from "@devvit/web/server";
import { PostFound } from "../types.js";
import json2md from "json2md";
import markdownEscape from "markdown-escape";

export async function alertByModmail (posts: PostFound[]) {
    if (posts.length === 0) {
        return;
    }

    const message: json2md.DataObject[] = [
        { p: "Here are the posts that are newly showing in trending feeds:" },
        { ul: posts.map(post => `* [${markdownEscape(post.post.title)}](${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})`) },
    ];

    await reddit.modMail.createModInboxConversation({
        subredditId: context.subredditId,
        subject: "Notification of posts on trending feeds",
        bodyMarkdown: json2md(message),
    });

    console.log("Modmail sent");
}
