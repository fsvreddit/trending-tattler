import type { Context } from "hono";
import { TriggerResponse } from "@devvit/web/shared";
import { onInstallOrUpgrade } from "../core";

export const onAppUpgrade = async (c: Context): Promise<Response> => {
    console.log("App Upgrade: Triggered");

    await onInstallOrUpgrade();

    return c.json<TriggerResponse>({ message: "app upgraded" }, 200);
};
