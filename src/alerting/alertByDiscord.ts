import { SettingsValues } from "@devvit/public-api";
import { PostFound } from "../types.js";
import { AppSetting } from "../settings.js";

export async function alertByDiscord (posts: PostFound[], settings: SettingsValues) {
    if (posts.length === 0) {
        return;
    }

    const webhookUrl = settings[AppSetting.ActionDiscordWebhookUrl] as string | undefined;
    if (!webhookUrl) {
        return;
    }

    const suppressEmbeds = settings[AppSetting.ActionDiscordSuppressEmbeds] as boolean | undefined ?? false;

    let message = "There are posts newly showing in trending feeds!\n";
    for (const post of posts) {
        if (webhookUrl.includes("slack.com")) {
            message += `* ${post.post.permalink} (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
        } else if (suppressEmbeds) {
            message += `* [${post.post.title}](<https://www.reddit.com${post.post.permalink}>) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
        } else {
            message += `* [${post.post.title}](https://www.reddit.com${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
        }
    }

    let params;
    if (webhookUrl.includes("discord.com")) {
        params = {
            content: message,
        };
    } else {
        params = {
            text: message,
        };
    }

    try {
        await fetch(
            webhookUrl,
            {
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            },
        );
        console.log("Alert sent to webhook");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Error sending alert to webhook: ${message}`);
    }
}
