import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleValidateWebhook = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    if (!validationRequest.value) {
        return c.json<SettingsValidationResponse>({
            success: true,
        }, 200);
    }

    const webhookRegex = /^https:\/\/(?:discord\.com\/api\/webhooks\/|hooks\.slack\.com\/services)/;
    if (!webhookRegex.test(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Please enter a valid Discord or Slack webhook URL",
        }, 200);
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
