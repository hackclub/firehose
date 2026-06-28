import type { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserExempt, deleteMessage, postEphemeral } from '../../utils/index.js';

async function newaccountListener({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
    if (!payload || payload.type !== 'message' || !('user' in payload)) return;

    const { user, ts, channel } = payload;
    if (!user) return;

    const prisma = getPrisma();

    const gate = await prisma.accountAgeGate.findUnique({ where: { channelId: channel } });
    if (!gate) return;

    if (await isUserExempt(user, channel)) return;

    const member = await prisma.memberJoinDate.findUnique({ where: { userId: user } });
    if (!member?.joinedAt) return;

    const ageMs = Date.now() - member.joinedAt.getTime();
    const minAgeMs = gate.minAgeDays * 86_400_000;
    if (ageMs >= minAgeMs) return;

    const daysRemaining = Math.ceil((minAgeMs - ageMs) / 86_400_000);

    await Promise.all([
        deleteMessage(channel, ts),
        postEphemeral(
            channel,
            user,
            `This channel requires your account to be at least ${gate.minAgeDays} day${gate.minAgeDays === 1 ? '' : 's'} old to post. You'll be able to post here in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
        ),
    ]);
}

export default newaccountListener;
