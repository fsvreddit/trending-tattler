import {Devvit} from "@devvit/public-api";
import {checkFeeds} from "./feedChecker.js";
import {appSettings} from "./settings.js";
import {onInstallOrUpgrade} from "./installTasks.js";

Devvit.addSettings(appSettings);

Devvit.addSchedulerJob({
    name: "checkFeeds",
    onRun: checkFeeds,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: onInstallOrUpgrade,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: true,
});

export default Devvit;
