import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";

export async function onInstallOrUpgrade (_: AppInstall | AppUpgrade, context: TriggerContext) {
    // Clear down existing scheduler jobs, if any, in case a new release changes the schedule
    const currentJobs = await context.scheduler.listJobs();
    await Promise.all(currentJobs.map(job => context.scheduler.cancelJob(job.id)));

    // Choose a randomised schedule per install. Run every 15 minutes but not all running at the same time.
    const minute = Math.floor(Math.random() * 15);
    console.log(`App updated to ${context.appVersion}.`);
    console.log(`Running at ${minute} and every 15 minutes thereafter.`);

    await context.scheduler.runJob({
        cron: `${minute}/15 * * * *`,
        name: "checkFeeds",
    });
}
