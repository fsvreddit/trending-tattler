import { scheduler } from "@devvit/web/server";
import { UiResponse } from "@devvit/web/shared";
import { Context } from "hono";
import { SchedulerJob } from "../core";
import { CheckFeedsJobData } from "../tasks";

interface TestTrendingTattlerFormField {
    confirm: boolean;
}

export const handleTestTrendingTattlerForm = async (c: Context): Promise<Response> => {
    const data = await c.req.json<TestTrendingTattlerFormField>();

    if (data.confirm) {
        await scheduler.runJob<CheckFeedsJobData>({
            name: SchedulerJob.CheckFeeds,
            data: { testMode: true },
            runAt: new Date(),
        });
    }

    return c.json<UiResponse>({
        showToast: "A random post on your sub will be now treated as if it was trending based on configured options..",
    });
};
