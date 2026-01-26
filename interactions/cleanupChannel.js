// const { response } = require('express');
// const readOnly = require('../commands/readOnly');
const { getPrisma } = require('../utils/prismaConnector');
const { env } = require('../utils/env');

/** @param {import('@slack/bolt').SlackEventMiddlewareArgs<'message'> & import('@slack/bolt').AllMiddlewareArgs} args */
async function cleanupChannel(args) {
    const { client, payload } = args;
    if (!payload || !payload.type || payload.type !== 'message' || !('user' in payload)) return;
    const { user, ts, text, channel, subtype } = payload;
    const thread_ts = 'thread_ts' in payload ? payload.thread_ts : null;
    const bot_id = 'bot_id' in payload ? payload.bot_id : null;
    const prisma = getPrisma();
    // console.log(payload)

    if (!user) {
        console.warn('No user found in payload, skipping cleanupChannel.');
        return;
    }

    const userInfo = await client.users.info({ user: user });
    const isAdmin = userInfo.user?.is_admin || userInfo.user?.is_owner;
    // console.log('isAdmin', isAdmin);

    if (isAdmin) return;

    // console.log('Channel Cleanup Triggered');

    const getChannel = await prisma.channel.findFirst({
        where: {
            id: channel,
            readOnly: true,
        },
    });
    // console.log(getChannel);

    // console.log(
    //     'User:',
    //     user,
    //     'Channel:',
    //     channel,
    //     'Thread TS:',
    //     thread_ts,
    //     'Message TS:',
    //     ts,
    //     'Subtype:',
    //     subtype
    // );

    // console.log('Checking if user is allowed in channel:', channel, 'User:', user);
    const allowlist = await prisma.channel.findFirst({
        where: {
            id: channel,
            allowlist: {
                has: user,
            },
        },
    });

    if (!getChannel) return;

    // console.log('Channel is read-only, checking message timestamps:', ts, thread_ts);
    // console.log('Allowlist status:', allowlist ? 'User is allowed' : 'User is not allowed');

    if (thread_ts) {
        // console.log("Message is in a thread, checking if it's a broadcast thread");
        try {
            const threadMessage = await client.conversations.replies({
                channel: channel,
                ts: thread_ts,
            });

            // console.log('Thread messages fetched:', threadMessage.messages);
            // const isThreadBroadcast = threadMessage.messages.some(msg => msg.subtype === 'thread_broadcast');
            const isThreadBroadcast = subtype === 'thread_broadcast'; // check the current msg
            if (isThreadBroadcast) {
                // console.log('Thread is a broadcast, deleting message:', ts);
                await client.chat.delete({
                    channel: channel,
                    ts: ts,
                    token: env.SLACK_USER_TOKEN,
                });

                if (!bot_id) {
                    await client.chat.postEphemeral({
                        channel: channel,
                        user: user,
                        text: "This channel is read-only! If you're replying to something, send a message in a thread.",
                    });
                }
            }
        } catch (e) {
            console.error('Error fetching thread messages:', e);
        }
        return;
    } else {
        // console.log("Message is not in a thread, moving to delete it if it's not allowed");
    }

    if (allowlist) {
        // console.log('User is allowed in this channel, no action taken.');
        return;
    }
    if (text) {
        // console.log('User is not allowed in this channel, proceeding to delete message:', ts);

        // console.log(`Message found by ${user}, deleting it:`, text);
        try {
            await client.chat.delete({
                channel: channel,
                ts: ts,
                token: env.SLACK_USER_TOKEN,
            });
            console.log('Message deleted successfully');
        } catch (e) {
            console.error('Error deleting message:', e);
        }
        await client.chat.postEphemeral({
            channel: channel,
            user: user,
            text: "This channel is read-only! If you're replying to something, send a message in a thread.",
        });
    }

    // console.log('Checking if message is a file share', subtype);

    if (!subtype) {
        // console.log('There is no other subtype to delete, exiting cleanup.');
        // console.log(user, channel, ts, thread_ts, text, subtype);
        return;
    }

    if (subtype === 'file_share') {
        // console.log('Message is a file share, deleting it:', ts);
        try {
            // console.log('Deleting file share message:', ts);
            await client.chat.delete({
                channel: channel,
                ts: ts,
                token: env.SLACK_USER_TOKEN,
            });
            await client.chat.postEphemeral({
                channel: channel,
                user: user,
                text: "This channel is read-only! If you're replying to something, send a message in a thread.",
            });
            // console.log('File share message deleted successfully');
        } catch (e) {
            // console.error('Error deleting message:', e);
        }
    }
}

module.exports = cleanupChannel;
