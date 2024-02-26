import {Devvit} from "@devvit/public-api";
import {checkFeeds} from "./feedChecker.js";
import {appSettings} from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addSchedulerJob({
    name: "checkFeeds",
    onRun: checkFeeds,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    async onEvent (_, context) {
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
    },
});

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: true,
});

export default Devvit;
