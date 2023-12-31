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
                label: "Discord notifications",
                fields: [
                    {
                        type: "boolean",
                        name: "actionSendDiscordMessage",
                        label: "Send Discord Notification",
                        helpText: "Send a notification to a Discord channel. Recommended use is for private moderation spaces only",
                    },
                    {
                        type: "string",
                        name: "actionDiscordWebhookUrl",
                        label: "Discord Webhook URL",
                        onValidate: ({value}) => {
                            const webhookRegex = /^https:\/\/discord.com\/api\/webhooks\//;
                            if (value && !webhookRegex.test(value)) {
                                return "Please enter a valid Discord webhook URL";
                            }
                        },
                    },
                ],
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
            {
                type: "group",
                label: "Sticky comment options",
                fields: [
                    {
                        type: "select",
                        name: "actionStickyCommentOption",
                        label: "Sticky Comment",
                        helpText: "Adds a sticky comment to welcome people not used to the subreddit",
                        options: [
                            {value: "none", label: "Do not add a sticky comment"},
                            {value: "addifnone", label: "Add a sticky comment if there is not already one present"},
                            {value: "addalways", label: "Add a sticky comment even if one is present"},
                        ],
                        multiSelect: false,
                        defaultValue: ["none"],
                    },
                    {
                        type: "paragraph",
                        name: "actionStickyCommmentContent",
                        label: "Sticky Comment Text",
                        helpText: "The text to include in the sticky comment",
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
