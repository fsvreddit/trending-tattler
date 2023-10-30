import {Post, ScheduledJobEvent, Subreddit, TriggerContext} from "@devvit/public-api";
import {addDays} from "date-fns";

interface PostFound {
    post: Post,
    foundInFeed: string[]
}

const ALERTED_POSTS_KEY = "AlertedPosts";

export async function checkFeeds (event: ScheduledJobEvent, context: TriggerContext) {
    const feedsToMonitor = await context.settings.get<string[]>("feedsToMonitor");
    if (!feedsToMonitor || feedsToMonitor.length === 0) {
        console.log("No feeds selected for monitoring!");
        return;
    }

    const actionSendModmail = await context.settings.get<boolean>("actionSendModmail") ?? true;
    const actionReportPost = await context.settings.get<boolean>("actionReportPost") ?? false;
    const actionSetFlair = await context.settings.get<string[]>("actionSetFlair");
    let flairAction = "none";
    if (actionSetFlair && actionSetFlair.length > 0) {
        flairAction = actionSetFlair[0];
    }

    // Are any actions defined? You'd hope so, but check and quit if not.
    if (!actionSendModmail && !actionReportPost && flairAction === "none") {
        console.log("No actions are set. No point checking for trending posts.");
        return;
    }

    const numberOfPostsToCheck = await context.settings.get<number>("numberOfPostsToCheck") ?? 100;
    const currentSubreddit = await context.reddit.getCurrentSubreddit();

    const foundPosts: PostFound[] = [];

    for (const feed of feedsToMonitor) {
        const posts = await context.reddit.getHotPosts({
            subredditName: feed,
            limit: numberOfPostsToCheck,
        }).all();

        for (const post of posts.filter(post => post.subredditName === currentSubreddit.name)) {
            const existingFoundPost = foundPosts.find(existingPost => existingPost.post.id === post.id);
            if (existingFoundPost) {
                existingFoundPost.foundInFeed.push(feed);
            } else {
                foundPosts.push({post, foundInFeed: [feed]});
            }
        }
    }

    // if (currentSubreddit.name === "fsvsandbox") {
    //     const testPost1 = await context.reddit.getPostById("t3_17ifpmo");
    //     const testPost2 = await context.reddit.getPostById("t3_17akzdh");

    //     foundPosts.push(
    //         {post: testPost1, foundInFeed: ["all"]},
    //         {post: testPost2, foundInFeed: ["all", "popular"]},
    //     );
    // }

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

    for (const post of foundPostsNotAlerted) {
        if (actionReportPost) {
            actionPromises.push(alertByReport(post, context));
        }

        if (flairAction !== "none") {
            actionPromises.push(alertByFlair(flairAction, post, context));
        }
        actionPromises.push(context.redis.zAdd("ALERTED_POSTS_KEY", {member: post.post.id, score: new Date().getTime()}));
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

    let message = "There are new posts in trending feeds that have not been alerted on before.\n\n";

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

async function alertByReport (post: PostFound, context: TriggerContext) {
    const featureEnabled = await context.settings.get<boolean>("actionReportPost") ?? false;
    if (!featureEnabled) {
        return;
    }

    await context.reddit.report(post.post, {reason: `This post is trending! It is currently in these feeds: ${post.foundInFeed.map(feed => `/r/${feed}`).join(", ")}`});
}

async function alertByFlair (flairAction: string, post: PostFound, context: TriggerContext) {
    const actionFlairText = await context.settings.get<string>("actionFlairText");

    let actionFlairCssClass = await context.settings.get<string>("actionFlairCssClass");
    if (actionFlairCssClass === "") {
        actionFlairCssClass = undefined;
    }

    let actionFlairTemplateId = await context.settings.get<string>("actionFlairTemplateId");
    if (actionFlairTemplateId === "") {
        actionFlairTemplateId = undefined;
    }

    if (!actionFlairText && !actionFlairCssClass) {
        return;
    }

    if (flairAction === "set" && (post.post.flair && post.post.flair.text)) {
        // Flair already set.
        return;
    }

    if (actionFlairTemplateId) {
        await context.reddit.setPostFlair({
            postId: post.post.id,
            subredditName: post.post.subredditName,
            flairTemplateId: actionFlairTemplateId,
        });
    } else {
        await context.reddit.setPostFlair({
            postId: post.post.id,
            subredditName: post.post.subredditName,
            text: actionFlairText,
            cssClass: actionFlairCssClass,
        });
    }
}
