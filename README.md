# FireHose
FireHose is a moderation helper bot that brings discord style moderation tools to the Slack to make moderating the Slack easier

You can test read-only mode [here](https://hackclub.slack.com/archives/C086NP2JC8N), send me a dm on Slack @radioblahaj if you want to try mute or channel ban!

It lets us:
- Mute people from the Slack (with optional timed mutes)
- Mute people from Channels only
- Make Channels read only & Whitelist people
- Start slow mode (WIP)

## Commands

### `/shush @user reason`
Mutes a user from all Slack channels permanently. Only admins can use this command.

Example: `/shush @john spamming the channels`

### `/shush @user reason for <time>`
Mutes a user from all Slack channels temporarily. The user will be automatically unmuted after the specified time.

Examples:
- `/shush @john spamming the channels for 1 hour`
- `/shush @jane inappropriate behavior for 2 days`
- `/shush @bob being disruptive for 30 minutes`

The time can be specified using natural language (e.g., "1 hour", "2 days", "30 minutes", "tomorrow at 3pm").

### `/unshush @user`
Manually unmutes a user before their shush expires or for permanent shushes.

## Filesystem
- ```interactions``` is where the code for deleting messages, slow mode (WIP), muting people, and making channels read only; It also joins every new channel
![alt text](image.png) on creation (outside of interactions)
- ```commands``` is where the code to trigger read only mode, mutes, and channel bans live
- ```utils``` has helper functions to use Prisma, and things that haven't been shipped yet such as automatic ban timers


