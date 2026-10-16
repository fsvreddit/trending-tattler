import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { onAppInstall, onAppUpgrade } from "./triggers";
import { handleSelectFieldHasOptionChosen, handleNumberOfPostsToCheck, handleValidateWebhook } from "./validators";
import { handleCheckFeedsJob } from "./tasks";
import { handleTestTrendingTattlerMenu } from "./menus";
import { handleTestTrendingTattlerForm } from "./forms";

const application = new Hono();

// Triggers
application.post("/internal/triggers/app-install", onAppInstall);
application.post("/internal/triggers/app-upgrade", onAppUpgrade);

// Settings validators
application.post("/internal/validators/select-field-has-option-chosen", handleSelectFieldHasOptionChosen);
application.post("/internal/validators/number-of-posts-to-check", handleNumberOfPostsToCheck);
application.post("/internal/validators/validate-webhook", handleValidateWebhook);

// Scheduler jobs
application.post("/internal/jobs/check-feeds", handleCheckFeedsJob);

// Menus
application.post("/internal/menu/test-trending-tattler", handleTestTrendingTattlerMenu);

// Form handlers
application.post("/internal/forms/test-trending-tattler", handleTestTrendingTattlerForm);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
