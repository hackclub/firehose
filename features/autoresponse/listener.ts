import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';

const COMMUNITY_LOGS_CHANNEL = 'C085UEFDW6R';
const EMOJIS = new Set([
	'fd-reason',
	'reason-fd',
	'dont-give-reason',
	'this-is-literally-not-a-reason',
	'blunder',
	'real-chess-blunder',
]);

export default async function listener({
	event,
	client,
}: SlackEventMiddlewareArgs<'reaction_added'> & AllMiddlewareArgs) {
	if (event.item.type !== 'message') return;
	if (event.item.channel !== COMMUNITY_LOGS_CHANNEL) return;
	if (!EMOJIS.has(event.reaction)) return;
	const userInfo = await client.users.info({ user: event.user });
	const user = userInfo.user;
	if (!user || user.is_bot || user.is_app_user) return;
	const dm = await client.conversations.open({ users: event.user });
	const dmChannel = dm.channel?.id;
	if (!dmChannel) return;
	const RESPONSE = `Hi <@${event.user}>, we saw that you were asking for the reason behind a conduct action.

Here are some real cases we've dealt with in the past:
- Alice and Bob know each other in real life. Alice is harassing and threatening Bob. Bob reports Alice. If we tell everyone "Alice was banned for harassing and threatening someone", word will get back to Alice, who will know Bob reported her, and may go after him in real life.
- Alice confidentially reports Bob. Bob's ban is logged, along with a reason. Alice's friends immediately figure out that she must have been the one who reported Bob.
- Alice is being harassed by Bob. We ban Bob, who keeps making alt accounts to harass her more. This is logged. Charlie reads the logs, and decides it would be funny to also create alt accounts and harass Alice.

In some cases, giving information wouldn't cause problems. But! Then any time we didn't give information, people would know that giving information would cause problems, which would let them deduce things about the nature of the case. And that's exactly what we're trying to avoid!

We understand that it's hard to trust what you can't see. But giving too much information about ban reasons can and does hurt Hack Clubbers.`;
	await client.chat.postMessage({
		channel: dmChannel,
		text: RESPONSE,
	});
}
