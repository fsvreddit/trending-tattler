import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { addDays } from "date-fns";

export async function onInstallOrUpgrade (_: AppInstall | AppUpgrade, context: TriggerContext) {
    // Clear down existing scheduler jobs, if any, in case a new release changes the schedule
    const currentJobs = await context.scheduler.listJobs();
    await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));

    // Choose a randomised schedule per install. Run every 30 minutes but not all running at the same time.
    const minute = Math.floor(Math.random() * 30);
    console.log(`Running at ${minute} and ${minute + 30} past the hour`);

    await context.scheduler.runJob({
        cron: `${minute}/30 * * * *`,
        name: "checkFeeds",
    });

    // One time data migration from sorted set to expiring keys
    const setContents = await context.redis.zRange("AlertedPosts", 0, -1);
    const promises: Promise<unknown>[] = setContents.map(item => context.redis.set(`alerted~${item.member}`, "true", { expiration: addDays(item.score, 3) }));
    promises.push(context.redis.del("AlertedPosts"));
    await Promise.all(promises);
}
