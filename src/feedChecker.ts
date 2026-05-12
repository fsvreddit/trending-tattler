import { Context, FormOnSubmitEvent, JSONObject, MenuItemOnPressEvent, Post, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { AppSetting, HotPostLocation, SetFlairOption, StickyCommentOption } from "./settings.js";
import { addDays } from "date-fns";
import _ from "lodash";
import { testModeConfirmationForm } from "./main.js";
import { CrowdControlOption, setCrowdControl } from "@fsvreddit/fsv-devvit-helpers";
import { PostFound } from "./types.js";
import { alertByDiscord, alertByFlair, alertByModmail, alertByReport, alertByStickyComment } from "./alerting/index.js";
import pluralize from "pluralize";

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

function getAlertedKeyForPost (post: Post) {
    return `alerted~${post.id}`;
}

export async function checkFeeds (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
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

    const [actionSetCrowdControl] = settings[AppSetting.ActionSetCrowdControl] as [CrowdControlOption] | undefined ?? [CrowdControlOption.None];

    // Are any actions defined? You'd hope so, but check and quit if not.
    if (!actionSendModmail && !actionSendDiscordMessage && !actionReportPost && flairAction === SetFlairOption.None && actionStickyCommentOption === StickyCommentOption.None && actionSetCrowdControl === CrowdControlOption.None) {
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
        const currentSubredditName = context.subredditName ?? (await context.reddit.getCurrentSubreddit()).name;
        const posts = await context.reddit.getHotPosts({
            subredditName: currentSubredditName,
            limit: 100,
        }).all();

        const postToAlert = posts[Math.floor(Math.random() * posts.length)];

        foundPosts.push({
            post: postToAlert,
            foundInFeed: ["testing"],
        });
    }

    if (foundPosts.length === 0) {
        let message = `No posts found in trending feeds - checked ${feedsToMonitor.join(", ")}`;
        if (hotPostLocation !== HotPostLocation.Everywhere as string) {
            message += `, location ${hotPostLocation}`;
        }
        console.log(message);
        return;
    }

    const foundPostsNotAlerted: PostFound[] = [];
    for (const post of foundPosts) {
        const alreadyAlerted = await context.redis.get(getAlertedKeyForPost(post.post));
        if (!alreadyAlerted) {
            foundPostsNotAlerted.push(post);
        }
    }

    if (foundPostsNotAlerted.length === 0) {
        console.log(`There are ${foundPostsNotAlerted.length} ${pluralize("post", foundPostsNotAlerted.length)} currently in trending feeds, but they have already been handled`);
        return;
    }

    console.log(`Posts in trending feeds: ${foundPostsNotAlerted.map(post => post.post.id).join(", ")}`);

    const actionPromises: Promise<unknown>[] = [];

    if (actionSendModmail) {
        actionPromises.push(alertByModmail(foundPostsNotAlerted, context));
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
            actionPromises.push(alertByStickyComment(actionStickyCommentOption, post, settings));
        }

        if (post.foundInFeed.some(sub => sub !== "testing")) {
            actionPromises.push(context.redis.set(getAlertedKeyForPost(post.post), "true", { expiration: addDays(new Date(), 3) }));
        }

        if (actionSetCrowdControl !== CrowdControlOption.None) {
            actionPromises.push(setCrowdControl(post.post, actionSetCrowdControl, context));
        }
    }

    await Promise.all(actionPromises);
}

export async function confirmationFormHander (event: FormOnSubmitEvent<JSONObject>, context: Context) {
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
