import { reddit, scheduler, settings } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import type { Context } from "hono";
import { AppSetting, FormName, SchedulerJob, SetFlairOption, StickyCommentOption } from "../core";
import { CheckFeedsJobData } from "../tasks/handleCheckFeeds";

export const handleTestTrendingTattlerMenu = async (c: Context): Promise<Response> => {
    const subreddit = await reddit.getCurrentSubreddit();
    const appSettings = await settings.getAll();

    const setFlairOption = (appSettings[AppSetting.ActionSetFlair] as SetFlairOption[] | undefined ?? [SetFlairOption.None])[0];
    const stickyCommentAction = (appSettings[AppSetting.ActionStickyCommentOption] as StickyCommentOption[] | undefined ?? [StickyCommentOption.None])[0];

    // If subreddit has a non-trivial number of subscribers, and has user-facing effects, ask for confirmation.
    if (subreddit.numberOfSubscribers > 50 && (setFlairOption !== SetFlairOption.None || stickyCommentAction !== StickyCommentOption.None)) {
        return c.json<UiResponse>({
            showForm: {
                name: FormName.TestTrendingTattler,
                form: {
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
                },
            },
        });
    } else {
        await scheduler.runJob<CheckFeedsJobData>({
            name: SchedulerJob.CheckFeeds,
            data: { testMode: true },
            runAt: new Date(),
        });

        return c.json<UiResponse>({
            showToast: "A random post on your sub will be now treated as if it was trending based on configured options..",
        });
    }
};
