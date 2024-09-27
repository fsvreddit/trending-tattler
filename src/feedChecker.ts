import { Context, FormOnSubmitEvent, MenuItemOnPressEvent, Post, ScheduledJobEvent, SettingsValues, TriggerContext } from "@devvit/public-api";
import { AppSetting, HotPostLocation, SetFlairOption, StickyCommentOption } from "./settings.js";
import { addDays } from "date-fns";
import _ from "lodash";
import { testModeConfirmationForm } from "./main.js";

interface PostFound {
    post: Post;
    foundInFeed: string[];
}

// Definition taken from GetHotPostsOptions.
type HotPostLocationVal = "GLOBAL" | "US" | "AR" | "AU" | "BG" | "CA" | "CL" | "CO" | "HR" | "CZ" | "FI" | "FR" | "DE" | "GR" | "HU" | "IS" | "IN" | "IE" | "IT" | "JP" | "MY" | "MX" | "NZ" | "PH" | "PL" | "PT" | "PR" | "RO" | "RS" | "SG" | "ES" | "SE" | "TW" | "TH" | "TR" | "GB" | "US_WA" | "US_DE" | "US_DC" | "US_WI" | "US_WV" | "US_HI" | "US_FL" | "US_WY" | "US_NH" | "US_NJ" | "US_NM" | "US_TX" | "US_LA" | "US_NC" | "US_ND" | "US_NE" | "US_TN" | "US_NY" | "US_PA" | "US_CA" | "US_NV" | "US_VA" | "US_CO" | "US_AK" | "US_AL" | "US_AR" | "US_VT" | "US_IL" | "US_GA" | "US_IN" | "US_IA" | "US_OK" | "US_AZ" | "US_ID" | "US_CT" | "US_ME" | "US_MD" | "US_MA" | "US_OH" | "US_UT" | "US_MO" | "US_MN" | "US_MI" | "US_RI" | "US_KS" | "US_MT" | "US_MS" | "US_SC" | "US_KY" | "US_OR" | "US_SD";

export async function getResultsForFeed (feed: string, numberOfPostsToCheck: number, context: TriggerContext, location: HotPostLocationVal): Promise<PostFound[]> {
    const posts = await context.reddit.getHotPosts({
        subredditName: feed,
        limit: numberOfPostsToCheck,
        location,
    }).all();

    return posts.map(post => ({ post, foundInFeed: [feed] }));
}

export async function checkFeeds (event: ScheduledJobEvent, context: TriggerContext) {
    const settings = await context.settings.getAll();

    const feedsToMonitor = settings[AppSetting.FeedsToMonitor] as string[] | undefined ?? [];
    if (feedsToMonitor.length === 0) {
        console.log("No feeds selected for monitoring!");
        return;
    }

    const actionSendModmail = settings[AppSetting.ActionSendModmail] as boolean | undefined ?? true;
    const actionReportPost = settings[AppSetting.ActionReportPost] as boolean | undefined ?? false;
    const actionSendDiscordMessage = settings[AppSetting.ActionSendDiscordMessage] as boolean | undefined ?? false;
    const actionSetFlair = settings[AppSetting.ActionSetFlair] as string[] | undefined ?? [];
    const actionCreateStickyComment = settings[AppSetting.ActionStickyCommentOption] as string[] | undefined ?? [];
    const hotPostLocation = (settings[AppSetting.Location] as string[] | undefined ?? [HotPostLocation.Everywhere])[0] as HotPostLocationVal;

    let flairAction = SetFlairOption.None;
    if (actionSetFlair.length > 0) {
        flairAction = actionSetFlair[0] as SetFlairOption;
    }

    let actionStickyCommentOption = StickyCommentOption.None;
    if (actionCreateStickyComment.length > 0) {
        actionStickyCommentOption = actionCreateStickyComment[0] as StickyCommentOption;
    }

    // Are any actions defined? You'd hope so, but check and quit if not.
    if (!actionSendModmail && !actionSendDiscordMessage && !actionReportPost && flairAction === SetFlairOption.None && actionStickyCommentOption === StickyCommentOption.None) {
        console.log("No actions are set. No point checking for trending posts.");
        return;
    }

    const numberOfPostsToCheck = settings[AppSetting.NumberOfPostsToCheck] as number | undefined ?? 100;

    const foundPosts: PostFound[] = [];

    const results = await Promise.all(feedsToMonitor.map(feed => getResultsForFeed(feed, numberOfPostsToCheck, context, hotPostLocation)));
    const flatResults = _.flatten(results);

    for (const item of flatResults.filter(post => post.post.subredditId === context.subredditId)) {
        const existingFoundPost = foundPosts.find(existingPost => existingPost.post.id === item.post.id);
        if (existingFoundPost) {
            existingFoundPost.foundInFeed.push(item.foundInFeed[0]);
        } else {
            foundPosts.push(item);
        }
    }

    if (event.data?.testMode) {
        // Get a random post on subreddit, and treat it as if it is trending in a fictional subreddit
        const currentSubreddit = await context.reddit.getCurrentSubreddit();
        const posts = await context.reddit.getHotPosts({
            subredditName: currentSubreddit.name,
            limit: 100,
        }).all();

        const postToAlert = posts[Math.floor(Math.random() * posts.length)];

        foundPosts.push({
            post: postToAlert,
            foundInFeed: ["testing"],
        });
    }

    if (foundPosts.length === 0) {
        console.log("No posts found in trending feeds");
        return;
    }

    const foundPostsNotAlerted: PostFound[] = [];
    for (const post of foundPosts) {
        const alreadyAlerted = await context.redis.get(`alerted~${post.post.id}`);
        if (!alreadyAlerted) {
            foundPostsNotAlerted.push(post);
        }
    }

    if (foundPostsNotAlerted.length === 0) {
        console.log("There are posts currently in trending feeds, but they have already been handled");
        return;
    }

    console.log(`Posts in trending feeds: ${foundPostsNotAlerted.length}`);

    const actionPromises: Promise<unknown>[] = [];

    if (actionSendModmail) {
        const currentSubreddit = await context.reddit.getCurrentSubreddit();
        actionPromises.push(alertByModmail(foundPostsNotAlerted, currentSubreddit.name, context));
    }

    if (actionSendDiscordMessage) {
        actionPromises.push(alertByDiscord(foundPostsNotAlerted, settings));
    }

    for (const post of foundPostsNotAlerted) {
        if (actionReportPost) {
            actionPromises.push(alertByReport(post, context));
        }

        if (flairAction !== SetFlairOption.None) {
            actionPromises.push(alertByFlair(flairAction, post, context, settings));
        }

        if (actionStickyCommentOption !== StickyCommentOption.None) {
            actionPromises.push(alertByStickyComment(actionStickyCommentOption, post, context, settings));
        }

        if (post.foundInFeed.some(sub => sub !== "testing")) {
            actionPromises.push(context.redis.set(`alerted~${post.post.id}`, "true", { expiration: addDays(new Date(), 3) }));
        }
    }

    await Promise.all(actionPromises);
}

async function alertByModmail (posts: PostFound[], subredditName: string, context: TriggerContext) {
    if (posts.length === 0) {
        return;
    }

    const botAccount = await context.reddit.getAppUser();

    let message = "Here are the posts that are newly showing in trending feeds:\n\n";

    for (const post of posts) {
        message += `* [${post.post.title}](${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
    }

    await context.reddit.modMail.createConversation({
        to: botAccount.username,
        subject: "Notification of posts on trending feeds",
        body: message,
        isAuthorHidden: true,
        subredditName,
    });

    console.log("Modmail sent");
}

async function alertByDiscord (posts: PostFound[], settings: SettingsValues) {
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
        console.log(error);
    }
}

async function alertByReport (post: PostFound, context: TriggerContext) {
    await context.reddit.report(post.post, { reason: `This post is trending! It is currently in these feeds: ${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")}` });
    console.log("Post reported");
}

async function alertByFlair (flairAction: SetFlairOption, post: PostFound, context: TriggerContext, settings: SettingsValues) {
    let actionFlairText = settings[AppSetting.ActionFlairText] as string | undefined;
    if (actionFlairText === "") {
        actionFlairText = undefined;
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
        console.log(error);
    }
}

async function alertByStickyComment (stickyCommentAction: StickyCommentOption, post: PostFound, context: TriggerContext, settings: SettingsValues) {
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

    commentText = `${commentText.trim()}\n\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/${post.post.subredditName}) if you have any questions or concerns.*`;

    const newComment = await post.post.addComment({ text: commentText });
    await newComment.distinguish(true);
    console.log("Sticky comment left");
}

export async function confirmationFormHander (event: FormOnSubmitEvent, context: Context) {
    if (!event.values.confirm) {
        return;
    }

    await triggerTestMode(context);
}

export async function handleTextModeMenuItem (_: MenuItemOnPressEvent, context: Context) {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const settings = await context.settings.getAll();

    const setFlairOption = (settings[AppSetting.ActionSetFlair] as SetFlairOption[] | undefined ?? [SetFlairOption.None])[0];
    const stickyCommentAction = (settings[AppSetting.ActionStickyCommentOption] as StickyCommentOption[] | undefined ?? [StickyCommentOption.None])[0];

    // If subreddit has a non-trivial number of subscribers, and has user-facing effects, ask for confirmation.
    if (subreddit.numberOfSubscribers > 50 && (setFlairOption !== SetFlairOption.None || stickyCommentAction !== StickyCommentOption.None)) {
        context.ui.showForm(testModeConfirmationForm);
    } else {
        await triggerTestMode(context);
    }
}

export async function triggerTestMode (context: Context) {
    await context.scheduler.runJob({
        name: "checkFeeds",
        data: { testMode: true },
        runAt: new Date(),
    });

    context.ui.showToast("A random post on your sub will be now treated as if it was trending based on configured options.");
}
