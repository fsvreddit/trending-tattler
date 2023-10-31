import {Devvit} from "@devvit/public-api";
import {checkFeeds} from "./feedChecker.js";

Devvit.addSettings([
    {
        type: "select",
        name: "feedsToMonitor",
        label: "Feeds to monitor",
        options: [
            {value: "all", label: "/r/all"},
            {value: "popular", label: "/r/popular"},
        ],
        multiSelect: true,
        defaultValue: ["all"],
        onValidate: ({value}) => {
            if (!value || value.length === 0) {
                return "You must select at least one feed to monitor";
            }
        },
    },
    {
        type: "number",
        name: "numberOfPostsToCheck",
        label: "Number of posts to check in feeds",
        helpText: "The app will check this many posts from the feeds sorted by \"hot\"",
        defaultValue: 100,
        onValidate: ({value}) => {
            if (!value || value < 1 || value > 200) {
                return "Value must be between 1 and 200";
            }
        },
    },
    {
        type: "group",
        label: "Actions",
        fields: [
            {
                type: "boolean",
                name: "actionSendModmail",
                label: "Send Modmail",
                helpText: "Sends a modmail with links to the post(s) found",
                defaultValue: true,
            },
            {
                type: "boolean",
                name: "actionReportPost",
                label: "Report",
                helpText: "Reports post(s) that hit the specified feeds",
                defaultValue: false,
            },
            {
                type: "group",
                label: "Flair options",
                helpText: "If this is enabled, a flair template takes priority over text/class. It is suggested that EITHER a template OR text and class is provided.",
                fields: [
                    {
                        type: "select",
                        name: "actionSetFlair",
                        label: "Set Flair",
                        helpText: "Sets or overwrites flair for post(s) that hit the specified feeds",
                        options: [
                            {value: "none", label: "Do not set flair"},
                            {value: "set", label: "Set flair, if none set"},
                            {value: "overwrite", label: "Set flair, overwriting existing flair"},
                        ],
                        multiSelect: false,
                        defaultValue: ["none"],
                    },
                    {
                        type: "string",
                        name: "actionFlairText",
                        label: "Flair text",
                    },
                    {
                        type: "string",
                        name: "actionFlairCssClass",
                        label: "Flair CSS Class",
                    },
                    {
                        type: "string",
                        name: "actionFlairTemplateId",
                        label: "Flair Template ID",
                    },
                ],
            },
        ],
    },
]);

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

        await context.scheduler.runJob({
            cron: "15,45 * * * *", // Every 30 minutes
            name: "checkFeeds",
        });
    },
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
