import {TriggerContext} from "@devvit/public-api";

export async function getSubredditName (context: TriggerContext): Promise<string> {
    const redisKey = "subredditname";

    const subredditName = await context.redis.get(redisKey);
    if (subredditName) {
        return subredditName;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.redis.set(redisKey, subreddit.name);
    return subreddit.name;
}
