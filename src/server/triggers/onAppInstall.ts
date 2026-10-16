import type { Context } from "hono";
import { TriggerResponse } from "@devvit/web/shared";
import { onInstallOrUpgrade } from "../core";

export const onAppInstall = async (c: Context): Promise<Response> => {
    console.log("App Install: Triggered");

    await onInstallOrUpgrade();

    return c.json<TriggerResponse>({ message: "app installed" }, 200);
};
