# Trending Tattler

A Reddit Community App to alert subreddit moderators when a post hits a high traffic feed (i.e. /r/all, /r/popular). This can help you prepare for the extra workload of moderating a post that is liable to get busy fast.

The app runs on a schedule, every 30 minutes. It checks the top posts in the high traffic feeds (configurable), and if there are any present from the subreddit the app is installed in it, will take action.

Action will only be taken on a post once every three days, so if a post remains in the high traffic feed for a long period of time only one alert will be sent.

## Detection options

You can choose to monitor /r/all, /r/popular, or both.

You can choose how many posts to look back in these feeds, the default is 100 but you can configure the app to look back up to 200 posts.

## Action options

More than one action option can be selected at a time. If no options are set at all, the app will not check high traffic feeds until one is enabled.

### Modmail

If enabled, this will send a modmail with details of each post that has been newly found in the high traffic feed. 

![Example modmail](https://raw.githubusercontent.com/fsvreddit/trending-tattler/main/doc_images/modmail.png)

Note: By default, these notifications will go to the "Mod Discussions" inbox. If you want these to appear in the main inbox, you need to edit the app's permissions to remove "modmail" permissions.

## Send Discord or Slack Notification

If enabled, this will send a message to the Discord webhook specified. 

To learn how to create a Discord webhook, follow [this guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks), and use the "Copy Webhook URL" button within Discord and paste the URL into this app's configuration screen.

For Slack, see [this guide](https://kloudle.com/blog/how-to-create-slack-incoming-webhook-urls/).

![Example notification](https://raw.githubusercontent.com/fsvreddit/trending-tattler/main/doc_images/discord.png)

If Suppress Embeds is turned off, Discord may include an embed with a preview of the post. You can force this off if you wish with this option.

### Report

If enabled, this will report the post, making it obvious in the modqueue that the post has hit the high traffic feed.

![Example report](https://raw.githubusercontent.com/fsvreddit/trending-tattler/main/doc_images/report.png)

### Flair

This will set a flair on the post. This may be useful for alerting your users, but can also allow you to react to trending posts differently in automod rules or other bots that you may have running. 

If you want to use this setting, I recommend using one of these options:

* Flair text on its own (applies the text with default cosmetic settings)
* Flair text and CSS class combined (applies the text using the cosmetic settings of the CSS class)
* Flair text and flair template (applies the text using the cosmetic settings for the flair template)
* Flair template on its own (uses the flair text from the template)

### Sticky Comment

This gives you the option to create a sticky comment on the post as a "welcome" to people who might need a reminder of your subreddit's rules. You can choose to sticky a new comment regardless of whether there is one already present, or choose to only sticky a new comment if there's not one there already.

## Test Mode

Test Mode takes a random post on your subreddit and treats it as if it is trending in /r/testing, and alerts based on the option configured. This allows you to test your configuration to ensure that the options are set up to your liking.

To trigger Test Mode, choose the "..." context menu at the subreddit level, and choose "Test Trending Tattler". The appropriate alerting actions should take place nearly immediately.

If you have actions configured that are visible on the subreddit (post flairs, sticky comments, etc.) you may wish to test those on a private testing subreddit instead on the main subreddit.

Note: Test Mode is not available on Old Reddit or third-party Reddit clients due to limitations of Devvit. You will need to use the official Reddit app, or a more modern desktop experience.

## Recent changes

v1.5.1:

* Add "Test Mode" to allow mods to test out config before a post actually hits a trending feed
* Add support for limiting trending feed detection to specific locations
* Code improvements

v1.4.3 fixes an issue with Discord webhook support

v1.4.2 adds Slack webhook support.

v1.3 adds the ability to suppress embeds in Discord notifications, and adds "I am a bot" boilerplate text on all comments made by the app if that option is in use.

v1.2 added the ability to add a sticky comment on trending posts

v1.1 added Discord notifications 

## Source code

Trending Tattler is open source. You can find it on Github [here](https://github.com/fsvreddit/trending-tattler).
