import type {SlackEventMiddlewareArgs, AllMiddlewareArgs} from "@slack/bolt";
import { deleteMessage, postEphemeral } from "../../utils/index.js";

export default async function messageMatchListener({
    payload,
}: SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs): Promise<void> {
    if (!payload || payload.type !== 'message' || !('user' in payload) || !payload.user) {
        return;
    }

    if (payload.subtype && payload.subtype !== 'thread_broadcast') {
        return;
    }

    const thread_ts = 'thread_ts' in payload ? payload.thread_ts : undefined;
    if (!thread_ts) {
        return;
    }

    const messageText = payload.text ?? '';
    if (messageText !== "UNSUBSCRIBE") {
        return;
    }

    await Promise.all([
        deleteMessage(payload.channel, payload.ts),
        postEphemeral(
            payload.channel,
            payload.user,
            "To unsubscribe from notifications in the future, you can use 'Turn off notifications for replies' instead.",
            thread_ts
        ),
    ])
}