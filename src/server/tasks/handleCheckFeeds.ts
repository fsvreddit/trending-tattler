import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { Context } from "hono";
import { checkFeeds } from "../core";

export type CheckFeedsJobData = {
    testMode?: boolean;
};

export const handleCheckFeedsJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<CheckFeedsJobData>>();

    await checkFeeds(request);

    return c.json<TaskResponse>({ message: "Handled check feeds job." }, 200);
};
