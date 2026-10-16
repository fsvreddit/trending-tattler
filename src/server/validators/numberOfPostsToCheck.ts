import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleNumberOfPostsToCheck = async (c: Context) => {
    const validationRequest = await c.req.json<SettingsValidationRequest<number>>();

    if (validationRequest.value === undefined) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "You must provide a number of posts to check.",
        });
    }

    if (validationRequest.value < 1 || validationRequest.value > 200 || !Number.isInteger(validationRequest.value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "The number of posts to check must be a whole number between 1 and 200.",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
