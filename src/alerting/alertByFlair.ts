import { SettingsValues, TriggerContext } from "@devvit/public-api";
import { PostFound } from "../types.js";
import { AppSetting, SetFlairOption } from "../settings.js";

export async function alertByFlair (flairAction: SetFlairOption, post: PostFound, context: TriggerContext, settings: SettingsValues) {
    let actionFlairText = settings[AppSetting.ActionFlairText] as string | undefined;
    if (actionFlairText === "") {
        actionFlairText = undefined;
    }

    if (actionFlairText) {
        actionFlairText = actionFlairText.replace("{{feeds}}", post.foundInFeed.map(feed => `/r/${feed}`).join(", "));
    }

    let actionFlairCssClass = settings[AppSetting.ActionFlairCssClass] as string | undefined;
    if (actionFlairCssClass === "") {
        actionFlairCssClass = undefined;
    }

    let actionFlairTemplateId = settings[AppSetting.ActionFlairTemplateId] as string | undefined;
    if (actionFlairTemplateId === "") {
        actionFlairTemplateId = undefined;
    } else if (actionFlairTemplateId) {
        // Check to see if flair template exists for this site, if not then ignore.
        const flairTemplates = await context.reddit.getPostFlairTemplates(post.post.subredditName);
        if (!flairTemplates.some(x => x.id === actionFlairTemplateId)) {
            actionFlairTemplateId = undefined;
        }
    }

    if (!actionFlairText && !actionFlairCssClass) {
        return;
    }

    if (flairAction === SetFlairOption.Set && post.post.flair?.text) {
        // Flair already set.
        return;
    }

    try {
        await context.reddit.setPostFlair({
            postId: post.post.id,
            subredditName: post.post.subredditName,
            text: actionFlairText,
            cssClass: actionFlairCssClass,
            flairTemplateId: actionFlairTemplateId,
        });
        console.log("Post flair set.");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`Error setting post flair: ${message}`);
    }
}
