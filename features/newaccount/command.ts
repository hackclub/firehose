import type { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { getPrisma, isUserOwner, postEphemeral, logInternal } from '../../utils/index.js';

async function newaccountCommand({
    payload: { text, channel_id, user_id },
    ack,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
    ack();

    if (!isUserOwner(user_id)) {
        return await postEphemeral(channel_id, user_id, 'Only workspace owners can run this command.');
    }

    const parts = text.trim().split(/\s+/);
    const channel = parts[0]?.match(/<#([A-Z0-9]+)\|?.*>/)?.[1];
    const daysRaw = parts[1];

    if (!channel) {
        return await postEphemeral(
            channel_id,
            user_id,
            'Usage: `/newaccount #channel <days>` to set a minimum account age, or `/newaccount #channel` to remove it.'
        );
    }

    const prisma = getPrisma();

    if (!daysRaw) {
        await prisma.accountAgeGate.deleteMany({ where: { channelId: channel } });
        await Promise.all([
            postEphemeral(channel_id, user_id, `Account age requirement removed from <#${channel}>.`),
            logInternal(`<@${user_id}> removed the account age requirement from <#${channel}>.`),
        ]);
        return;
    }

    const days = parseInt(daysRaw, 10);
    if (isNaN(days) || days <= 0) {
        return await postEphemeral(channel_id, user_id, 'Days must be a positive integer.');
    }

    await prisma.accountAgeGate.upsert({
        where: { channelId: channel },
        update: { minAgeDays: days, setBy: user_id },
        create: { channelId: channel, minAgeDays: days, setBy: user_id },
    });

    await Promise.all([
        postEphemeral(
            channel_id,
            user_id,
            `<#${channel}> now requires accounts to be at least ${days} day${days === 1 ? '' : 's'} old to post.`
        ),
        logInternal(`<@${user_id}> set a ${days}-day account age requirement on <#${channel}>.`),
    ]);
}

export default newaccountCommand;
