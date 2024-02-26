import {SettingsFormField} from "@devvit/public-api";

export enum AppSetting {
    FeedsToMonitor = "feedsToMonitor",
    NumberOfPostsToCheck = "numberOfPostsToCheck",
    ActionSendModmail = "actionSendModmail",
    ActionReportPost = "actionReportPost",
    ActionSendDiscordMessage = "actionSendDiscordMessage",
    ActionDiscordWebhookUrl = "actionDiscordWebhookUrl",
    ActionSetFlair = "actionSetFlair",
    ActionFlairText = "actionFlairText",
    ActionFlairCssClass = "actionFlairCssClass",
    ActionFlairTemplateId = "actionFlairTemplateId",
    ActionStickyCommentOption = "actionStickyCommentOption",
    ActionStickyCommentContent = "actionStickyCommmentContent", // This has a typo but fixing will break installed apps.
}

enum TrendingFeed {
    All = "all",
    Popular = "popular",
}

export enum SetFlairOption {
    None = "none",
    Set = "set",
    Overwrite = "overwrite",
}

export enum StickyCommentOption {
    None = "none",
    AddIfNone = "addifnone",
    AddAlways = "addalways",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "select",
        name: AppSetting.FeedsToMonitor,
        label: "Feeds to monitor",
        options: [
            {value: TrendingFeed.All, label: `/r/${TrendingFeed.All}`},
            {value: TrendingFeed.Popular, label: `/r/${TrendingFeed.Popular}`},
        ],
        multiSelect: true,
        defaultValue: [TrendingFeed.All],
        onValidate: ({value}) => {
            if (!value || value.length === 0) {
                return "You must select at least one feed to monitor";
            }
        },
    },
    {
        type: "number",
        name: AppSetting.NumberOfPostsToCheck,
        label: "Number of posts to check in feeds",
        helpText: "The app will check this many posts from the feeds sorted by \"hot\"",
        defaultValue: 100,
        onValidate: ({value}) => {
            if (!value || value < 1 || value > 200) {
                return "Value must be between 1 and 200";
            }
        },
    },
    {
        type: "group",
        label: "Actions",
        fields: [
            {
                type: "boolean",
                name: AppSetting.ActionSendModmail,
                label: "Send Modmail",
                helpText: "Sends a modmail with links to the post(s) found",
                defaultValue: true,
            },
            {
                type: "boolean",
                name: AppSetting.ActionReportPost,
                label: "Report",
                helpText: "Reports post(s) that hit the specified feeds",
                defaultValue: false,
            },
            {
                type: "group",
                label: "Discord notifications",
                fields: [
                    {
                        type: "boolean",
                        name: AppSetting.ActionSendDiscordMessage,
                        label: "Send Discord Notification",
                        helpText: "Send a notification to a Discord channel. Recommended use is for private moderation spaces only",
                    },
                    {
                        type: "string",
                        name: AppSetting.ActionDiscordWebhookUrl,
                        label: "Discord Webhook URL",
                        onValidate: ({value}) => {
                            const webhookRegex = /^https:\/\/discord.com\/api\/webhooks\//;
                            if (value && !webhookRegex.test(value)) {
                                return "Please enter a valid Discord webhook URL";
                            }
                        },
                    },
                ],
            },
            {
                type: "group",
                label: "Flair options",
                helpText: "If this is enabled, a flair template takes priority over text/class. It is suggested that EITHER a template OR text and class is provided.",
                fields: [
                    {
                        type: "select",
                        name: AppSetting.ActionSetFlair,
                        label: "Set Flair",
                        helpText: "Sets or overwrites flair for post(s) that hit the specified feeds",
                        options: [
                            {value: SetFlairOption.None, label: "Do not set flair"},
                            {value: SetFlairOption.Set, label: "Set flair, if none set"},
                            {value: SetFlairOption.Overwrite, label: "Set flair, overwriting existing flair"},
                        ],
                        multiSelect: false,
                        defaultValue: [SetFlairOption.None],
                    },
                    {
                        type: "string",
                        name: AppSetting.ActionFlairText,
                        label: "Flair text",
                    },
                    {
                        type: "string",
                        name: AppSetting.ActionFlairCssClass,
                        label: "Flair CSS Class",
                    },
                    {
                        type: "string",
                        name: AppSetting.ActionFlairTemplateId,
                        label: "Flair Template ID",
                    },
                ],
            },
            {
                type: "group",
                label: "Sticky comment options",
                fields: [
                    {
                        type: "select",
                        name: AppSetting.ActionStickyCommentOption,
                        label: "Sticky Comment",
                        helpText: "Adds a sticky comment to welcome people not used to the subreddit",
                        options: [
                            {value: StickyCommentOption.None, label: "Do not add a sticky comment"},
                            {value: StickyCommentOption.AddIfNone, label: "Add a sticky comment if there is not already one present"},
                            {value: StickyCommentOption.AddAlways, label: "Add a sticky comment even if one is present"},
                        ],
                        multiSelect: false,
                        defaultValue: [StickyCommentOption.None],
                    },
                    {
                        type: "paragraph",
                        name: AppSetting.ActionStickyCommentContent,
                        label: "Sticky Comment Text",
                        helpText: "The text to include in the sticky comment",
                    },
                ],
            },
        ],
    },
];

