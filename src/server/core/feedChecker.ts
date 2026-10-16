import { context, Post, reddit, redis, settings, TaskRequest } from "@devvit/web/server";
import { AppSetting, HotPostLocation, SetFlairOption, StickyCommentOption } from ".";
import { alertByDiscord, alertByFlair, alertByModmail, alertByReport, alertByStickyComment } from "./alerting";
import { addDays } from "date-fns";
import _ from "lodash";
import { CrowdControlOption, setCrowdControl } from "@fsvreddit/fsv-devvit-web-helpers";
import { PostFound } from "./types.js";
import pluralize from "pluralize";
import { CheckFeedsJobData } from "../tasks";

// Definition taken from GetHotPostsOptions.
type HotPostLocationVal = "GLOBAL" | "US" | "AR" | "AU" | "BG" | "CA" | "CL" | "CO" | "HR" | "CZ" | "FI" | "FR" | "DE" | "GR" | "HU" | "IS" | "IN" | "IE" | "IT" | "JP" | "MY" | "MX" | "NZ" | "PH" | "PL" | "PT" | "PR" | "RO" | "RS" | "SG" | "ES" | "SE" | "TW" | "TH" | "TR" | "GB" | "US_WA" | "US_DE" | "US_DC" | "US_WI" | "US_WV" | "US_HI" | "US_FL" | "US_WY" | "US_NH" | "US_NJ" | "US_NM" | "US_TX" | "US_LA" | "US_NC" | "US_ND" | "US_NE" | "US_TN" | "US_NY" | "US_PA" | "US_CA" | "US_NV" | "US_VA" | "US_CO" | "US_AK" | "US_AL" | "US_AR" | "US_VT" | "US_IL" | "US_GA" | "US_IN" | "US_IA" | "US_OK" | "US_AZ" | "US_ID" | "US_CT" | "US_ME" | "US_MD" | "US_MA" | "US_OH" | "US_UT" | "US_MO" | "US_MN" | "US_MI" | "US_RI" | "US_KS" | "US_MT" | "US_MS" | "US_SC" | "US_KY" | "US_OR" | "US_SD";

export async function getResultsForFeed (feed: string, numberOfPostsToCheck: number, location: HotPostLocationVal): Promise<PostFound[]> {
    const posts = await reddit.getHotPosts({
        subredditName: feed,
        limit: numberOfPostsToCheck,
        location,
    }).all();

    return posts.map(post => ({ post, foundInFeed: [feed] }));
}

function getAlertedKeyForPost (post: Post) {
    return `alerted~${post.id}`;
}

export async function checkFeeds (event: TaskRequest<CheckFeedsJobData | undefined>) {
    const appSettings = await settings.getAll();

    const feedsToMonitor = appSettings[AppSetting.FeedsToMonitor] as string[] | undefined ?? [];
    if (feedsToMonitor.length === 0) {
        console.log("No feeds selected for monitoring!");
        return;
    }

    const actionSendModmail = appSettings[AppSetting.ActionSendModmail] as boolean | undefined ?? true;
    const actionReportPost = appSettings[AppSetting.ActionReportPost] as boolean | undefined ?? false;
    const actionSendDiscordMessage = appSettings[AppSetting.ActionSendDiscordMessage] as boolean | undefined ?? false;
    const actionSetFlair = appSettings[AppSetting.ActionSetFlair] as string[] | undefined ?? [];
    const actionCreateStickyComment = appSettings[AppSetting.ActionStickyCommentOption] as string[] | undefined ?? [];
    const hotPostLocation = (appSettings[AppSetting.Location] as string[] | undefined ?? [HotPostLocation.Everywhere])[0] as HotPostLocationVal;

    let flairAction = SetFlairOption.None;
    if (actionSetFlair.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
        flairAction = actionSetFlair[0] as SetFlairOption;
    }

    let actionStickyCommentOption = StickyCommentOption.None;
    if (actionCreateStickyComment.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
        actionStickyCommentOption = actionCreateStickyComment[0] as StickyCommentOption;
    }

    const [actionSetCrowdControl] = appSettings[AppSetting.ActionSetCrowdControl] as [CrowdControlOption] | undefined ?? [CrowdControlOption.None];

    // Are any actions defined? You'd hope so, but check and quit if not.
    if (!actionSendModmail && !actionSendDiscordMessage && !actionReportPost && flairAction === SetFlairOption.None && actionStickyCommentOption === StickyCommentOption.None && actionSetCrowdControl === CrowdControlOption.None) {
        console.log("No actions are set. No point checking for trending posts.");
        return;
    }

    const numberOfPostsToCheck = appSettings[AppSetting.NumberOfPostsToCheck] as number | undefined ?? 100;

    const foundPosts: PostFound[] = [];

    const results = await Promise.all(feedsToMonitor.map(feed => getResultsForFeed(feed, numberOfPostsToCheck, hotPostLocation)));
    const flatResults = _.flatten(results);

    for (const item of flatResults.filter(post => post.post.subredditId === context.subredditId)) {
        const existingFoundPost = foundPosts.find(existingPost => existingPost.post.id === item.post.id);
        if (existingFoundPost) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            existingFoundPost.foundInFeed.push(item.foundInFeed[0]!);
        } else {
            foundPosts.push(item);
        }
    }

    if (event.data?.testMode) {
        // Get a random post on subreddit, and treat it as if it is trending in a fictional subreddit
        const posts = await reddit.getHotPosts({
            subredditName: context.subredditName,
            limit: 100,
        }).all();

        const postToAlert = posts[Math.floor(Math.random() * posts.length)];

        if (!postToAlert) {
            throw new Error("No post found to alert.");
        }

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
        const alreadyAlerted = await redis.get(getAlertedKeyForPost(post.post));
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
        actionPromises.push(alertByModmail(foundPostsNotAlerted));
    }

    if (actionSendDiscordMessage) {
        actionPromises.push(alertByDiscord(foundPostsNotAlerted, appSettings));
    }

    for (const post of foundPostsNotAlerted) {
        if (actionReportPost) {
            actionPromises.push(alertByReport(post));
        }

        if (flairAction !== SetFlairOption.None) {
            actionPromises.push(alertByFlair(flairAction, post, appSettings));
        }

        if (actionStickyCommentOption !== StickyCommentOption.None) {
            actionPromises.push(alertByStickyComment(actionStickyCommentOption, post, appSettings));
        }

        if (post.foundInFeed.some(sub => sub !== "testing")) {
            actionPromises.push(redis.set(getAlertedKeyForPost(post.post), "true", { expiration: addDays(new Date(), 3) }));
        }

        if (actionSetCrowdControl !== CrowdControlOption.None) {
            actionPromises.push(setCrowdControl(post.post, actionSetCrowdControl));
        }
    }

    await Promise.all(actionPromises);
}
