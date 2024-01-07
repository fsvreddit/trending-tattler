import {Post, ScheduledJobEvent, Subreddit, TriggerContext} from "@devvit/public-api";
import {addDays} from "date-fns";
import _ from "lodash";

interface PostFound {
    post: Post,
    foundInFeed: string[]
}

const ALERTED_POSTS_KEY = "AlertedPosts";

export async function getResultsForFeed (feed: string, numberOfPostsToCheck: number, context: TriggerContext): Promise<PostFound[]> {
    const posts = await context.reddit.getHotPosts({
        subredditName: feed,
        limit: numberOfPostsToCheck,
    }).all();

    return posts.map(post => ({post, foundInFeed: [feed]}));
}

export async function checkFeeds (event: ScheduledJobEvent, context: TriggerContext) {
    const feedsToMonitor = await context.settings.get<string[]>("feedsToMonitor");
    if (!feedsToMonitor || feedsToMonitor.length === 0) {
        console.log("No feeds selected for monitoring!");
        return;
    }

    const actionSendModmail = await context.settings.get<boolean>("actionSendModmail") ?? true;
    const actionReportPost = await context.settings.get<boolean>("actionReportPost") ?? false;
    const actionSendDiscordMessage = await context.settings.get<boolean>("actionSendDiscordMessage") ?? false;
    const actionSetFlair = await context.settings.get<string[]>("actionSetFlair");
    const actionCreateStickyComment = await context.settings.get<string[]>("actionStickyCommentOption");

    let flairAction = "none";
    if (actionSetFlair && actionSetFlair.length > 0) {
        flairAction = actionSetFlair[0];
    }

    let actionStickyCommentOption = "none";
    if (actionCreateStickyComment && actionCreateStickyComment.length > 0) {
        actionStickyCommentOption = actionCreateStickyComment[0];
    }

    // Are any actions defined? You'd hope so, but check and quit if not.
    if (!actionSendModmail && !actionSendDiscordMessage && !actionReportPost && flairAction === "none" && actionStickyCommentOption === "none") {
        console.log("No actions are set. No point checking for trending posts.");
        return;
    }

    const numberOfPostsToCheck = await context.settings.get<number>("numberOfPostsToCheck") ?? 100;
    const currentSubreddit = await context.reddit.getCurrentSubreddit();

    const foundPosts: PostFound[] = [];

    const results = await Promise.all(feedsToMonitor.map(feed => getResultsForFeed(feed, numberOfPostsToCheck, context)));
    const flatResults = _.flatten(results);

    for (const item of flatResults.filter(post => post.post.subredditName === currentSubreddit.name)) {
        const existingFoundPost = foundPosts.find(existingPost => existingPost.post.id === item.post.id);
        if (existingFoundPost) {
            existingFoundPost.foundInFeed.push(item.foundInFeed[0]);
        } else {
            foundPosts.push(item);
        }
    }

    if (foundPosts.length === 0) {
        console.log("No posts found in trending feeds");
        return;
    }

    const alreadyAlertedPosts = await context.redis.zRange(ALERTED_POSTS_KEY, 0, -1);

    const foundPostsNotAlerted = foundPosts.filter(foundPost => !alreadyAlertedPosts.some(alertedPost => alertedPost.member === foundPost.post.id));

    if (foundPostsNotAlerted.length === 0) {
        console.log("There are posts currently in trending feeds, but they have already been handled");
        return;
    }

    const actionPromises: Promise<void | number>[] = [];

    if (actionSendModmail) {
        actionPromises.push(alertByModmail(foundPostsNotAlerted, currentSubreddit, context));
    }

    if (actionSendDiscordMessage) {
        actionPromises.push(alertByDiscord(foundPostsNotAlerted, context));
    }

    for (const post of foundPostsNotAlerted) {
        if (actionReportPost) {
            actionPromises.push(alertByReport(post, context));
        }

        if (flairAction !== "none") {
            actionPromises.push(alertByFlair(flairAction, post, context));
        }

        if (actionStickyCommentOption !== "none") {
            actionPromises.push(alertByStickyComment(actionStickyCommentOption, post, context));
        }

        actionPromises.push(context.redis.zAdd(ALERTED_POSTS_KEY, {member: post.post.id, score: new Date().getTime()}));
    }

    await Promise.all(actionPromises);

    // Now remove records of posts that hit trending feeds at least three days ago.
    const oldAlreadyAlertedPostsToPurge = alreadyAlertedPosts.filter(x => new Date(x.score) < addDays(new Date(), -3)).map(x => x.member);
    if (oldAlreadyAlertedPostsToPurge.length > 0) {
        await context.redis.zRem(ALERTED_POSTS_KEY, oldAlreadyAlertedPostsToPurge);
    }
}

async function alertByModmail (posts: PostFound[], subreddit: Subreddit, context: TriggerContext) {
    if (posts.length === 0) {
        return;
    }

    const botAccount = await context.reddit.getUserById(context.appAccountId);

    let message = "Here are the posts that are newly showing in trending feeds:\n\n";

    for (const post of posts) {
        message += `* [${post.post.title}](${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
    }

    await context.reddit.modMail.createConversation({
        to: botAccount.username,
        subject: "Notification of posts on trending feeds",
        body: message,
        isAuthorHidden: true,
        subredditName: subreddit.name,
    });
}

async function alertByDiscord (posts: PostFound[], context: TriggerContext) {
    if (posts.length === 0) {
        return;
    }

    const webhookUrl = await context.settings.get<string>("actionDiscordWebhookUrl");
    if (!webhookUrl) {
        return;
    }

    let message = "There are posts newly showing in trending feeds!\n";
    for (const post of posts) {
        message += `* [${post.post.title}](https://www.reddit.com${post.post.permalink}) (${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")})\n`;
    }

    const params = {
        content: message,
    };

    try {
        await fetch(
            webhookUrl,
            {
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            }
        );
    } catch (error) {
        console.log(error);
    }
}

async function alertByReport (post: PostFound, context: TriggerContext) {
    await context.reddit.report(post.post, {reason: `This post is trending! It is currently in these feeds: ${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")}`});
}

async function alertByFlair (flairAction: string, post: PostFound, context: TriggerContext) {
    let actionFlairText = await context.settings.get<string>("actionFlairText");
    if (actionFlairText === "") {
        actionFlairText = undefined;
    }

    let actionFlairCssClass = await context.settings.get<string>("actionFlairCssClass");
    if (actionFlairCssClass === "") {
        actionFlairCssClass = undefined;
    }

    let actionFlairTemplateId = await context.settings.get<string>("actionFlairTemplateId");
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

    if (flairAction === "set" && (post.post.flair && post.post.flair.text)) {
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
    } catch (error) {
        console.log(error);
    }
}

async function alertByStickyComment (stickyCommentAction: string, post: PostFound, context: TriggerContext) {
    if (stickyCommentAction === "addifnone") {
        const comments = await post.post.comments.all();
        if (comments.some(comment => comment.isStickied())) {
            return;
        }
    }

    const commentText = await context.settings.get<string>("actionStickyCommmentContent");
    if (!commentText) {
        return;
    }

    const newComment = await post.post.addComment({text: commentText});
    await newComment.distinguish(true);
}
