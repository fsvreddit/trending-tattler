#Trending Tattler

A Reddit Community App to alert subreddit moderators when a post hits a high traffic feed (i.e. /r/all, /r/popular). This can help you prepare for the extra workload of moderating a post that is liable to get busy fast.

The app runs on a schedule, every 30 minutes. It checks the top posts in the high traffic feeds (configurable), and if there are any present from the subreddit the app is installed in it, will take action.

Action will only be taken on a post once every three days, so if a post remains in the high traffic feed for a long period of time only one alert will be sent.

##Detection options

You can choose to monitor /r/all, /r/popular, or both.

You can choose how many posts to look back in these feeds, the default is 100 but you can configure the app to look back up to 200 posts.

##Action options

More than one action option can be selected at a time. If no options are set at all, the app will not check high traffic feeds until one is enabled.

###Modmail

If enabled, this will send a modmail with details of each post that has been newly found in the high traffic feed. 

###Report

If enabled, this will report the post, making it obvious in the modqueue that the post has hit the high traffic feed.

###Flair

This will set a flair on the post. This may be useful for alerting your users, but can also allow you to react to trending posts differently in automod rules or other bots that you may have running. 

If you want to use this functionality, you should **either** enter a flair text and (optional) flair CSS class, or a flair template ID (which can be copied from the Post Flair settings on New Reddit. If both flair text and a flair template are specified, the app will use the flair template.