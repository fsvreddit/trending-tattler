import { Devvit } from "@devvit/public-api";
import { checkFeeds, confirmationFormHander, handleTextModeMenuItem } from "./feedChecker.js";
import { appSettings } from "./settings.js";
import { onInstallOrUpgrade } from "./installTasks.js";

Devvit.addSettings(appSettings);

Devvit.addSchedulerJob({
    name: "checkFeeds",
    onRun: checkFeeds,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: onInstallOrUpgrade,
});

Devvit.addMenuItem({
    location: "subreddit",
    label: "Test Trending Tattler",
    forUserType: "moderator",
    onPress: handleTextModeMenuItem,
});

export const testModeConfirmationForm = Devvit.createForm({
    title: "Test Mode Confirmation",
    description: "This will cause user-visible effects on your subreddit based on your configured options.",
    fields: [
        {
            name: "confirm",
            label: "Tick this box to confirm you're OK with this.",
            type: "boolean",
            defaultValue: false,
        },
    ],
}, confirmationFormHander);

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: true,
});

export default Devvit;
