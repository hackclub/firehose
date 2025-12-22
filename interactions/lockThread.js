require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function lockThread(args) {
  receiver.router.get("/lock", async (req, res) => {
    const { key } = req.query;
    if (!process.env.API_KEY || key !== process.env.API_KEY)
      return res
        .status(401)
        .json({ ok: false, error: "Please provide a valid API key" });
    return await prisma.thread.findMany({
      where: {},
    });
  });
  receiver.router.post("/lock", async (req, res) => {
    const { id, user, time, reason, channel, key } = req.query;
    if (!process.env.API_KEY || key !== process.env.API_KEY)
      return res
        .status(401)
        .json({ ok: false, error: "Please provide a valid API key" });
    time = new Date(time).toISOString();
    if (!id || !user || !time || isNaN(new Date(time)) || !channel)
      return res
        .status(400)
        .json({ ok: false, error: "Give all of the fields" });
    const thread = await prisma.thread.findFirst({
      where: {
        id: id,
      },
    });
    var action = "";
    if (!thread) {
      await prisma.thread.create({
        data: {
          id: id,
          admin: user,
          lock_type: "test",
          time: time,
          reason,
          channel: channel,
          active: true,
        },
      });
      action = "locked";
    } else if (thread.active) {
      await prisma.thread.update({
        where: {
          id: id,
        },
        data: {
          id: id,
          admin: user,
          active: false,
        },
      });
      action = "unlocked";
    } else {
      await prisma.thread.update({
        where: {
          id: id,
        },
        data: {
          id: id,
          admin: user,
          time: time,
          active: true,
        },
      });
      action = "locked";
    }
    res.json({ success: true, action });
  });
  (async () => {
    async function autoUnlock() {
      let span;
      const threads = await prisma.thread.findMany({
        where: {
          time: {
            lte: new Date(),
          },
          active: true,
        },
      });
      threads.forEach(async (thread) => {
        await app.client.chat.postMessage({
          channel: process.env.SLACK_LOG_CHANNEL,
          text: `🔓 Thread unlocked in <#${thread.channel}>
Reason: Autounlock (triggered by cron job)
Admin: System
Link: https://hackclub.slack.com/archives/${thread.channel}/p${thread.id.toString().replace(".", "")}`,
        });
        try {
          await app.client.reactions.remove({
            // Remove lock reaction
            channel: thread.channel,
            name: "lock",
            timestamp: thread.id,
          });
        } catch (e) {}
        await prisma.thread.update({
          // Delete record from database
          where: {
            id: thread.id,
          },
          data: {
            active: false,
          },
        });
      });
    }
    setInterval(autoUnlock, 1000 * 60);
    app.view("lock_modal", async ({ view, ack, body, respond }) => {
      let span;
      try {
        var json = JSON.parse(view.private_metadata);
      } catch (e) {
        await ack();
        return respond(
          "Something bad happened. Likely more than one instance is running.",
        );
      }
      const thread_id = json.thread_id;
      const channel_id = json.channel_id;

      const submittedValues = view.state.values;
      let reason, expires;

      for (let key in submittedValues) {
        if (submittedValues[key]["plain_text_input-action"])
          reason = submittedValues[key]["plain_text_input-action"].value;
        if (submittedValues[key]["datetimepicker-action"])
          expires = new Date(
            submittedValues[key]["datetimepicker-action"].selected_date_time *
              1000,
          );
      }

      if (!reason)
        return await ack({
          response_action: "errors",
          errors: {
            "datetimepicker-action": "Please provide a reason.",
          },
        });
      if (new Date() > expires)
        return await ack({
          response_action: "errors",
          errors: {
            "datetimepicker-action": "Time cannot be in the past.",
          },
        });
      await ack();
      const thread = await prisma.thread.findFirst({
        where: {
          id: thread_id,
        },
      });
      if (!thread) {
        await prisma.thread.create({
          // Add thread lock to database
          data: {
            id: thread_id,
            admin: body.user.id,
            lock_type: "test",
            time: expires,
            reason,
            channel: channel_id,
            active: true,
          },
        });
      } else {
        await prisma.thread.update({
          // Update thread lock in database
          where: {
            id: thread_id,
          },
          data: {
            id: thread_id,
            admin: body.user.id,
            lock_type: "test",
            time: expires,
            reason,
            channel: channel_id,
            active: true,
          },
        });
      }

      await app.client.chat.postMessage({
        // Inform users in the thread that it is locked
        channel: channel_id,
        thread_ts: thread_id,
        text: `🔒 Thread locked. Reason: ${reason} (until: ${expires.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST)`,
      });

      await app.client.chat.postMessage({
        channel: process.env.SLACK_LOG_CHANNEL,
        text: `🔒 Thread locked in <#${channel_id}>
Reason: ${reason}
Expires: ${expires.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} (EST)
Link: https://hackclub.slack.com/archives/${channel_id}/p${thread_id.toString().replace(".", "")}`,
      });
      // Admin: <@${body.user.id}>

      try {
        await app.client.reactions.add({
          // Add lock reaction
          channel: channel_id,
          name: "lock",
          timestamp: thread_id,
        });
      } catch (e) {}
    });

    app.message(/.*/gim, async ({ message, say, body }) => {
      // Listen for all messages (/.*/gim is a regex)

      if (!message.thread_ts) return; // Return if not a thread
      const thread = await prisma.thread.findFirst({
        where: {
          id: message.thread_ts,
        },
      }); // Lookup and see if the thread is locked in the dataase
      if (!thread) return;
      try {
        if (thread.active && thread.time > new Date()) {
          try {
            await app.client.conversations.join({
              channel: message.channel,
            });
          } catch (e) {}
          const user = await app.client.users.info({ user: message.user });
          if (!user.user.is_admin) {
            await app.client.chat.postEphemeral({
              // Inform the user that the thread is currently locked. Do this first because deleting the message may not work.
              user: message.user,
              channel: message.channel,
              thread_ts: message.thread_ts,
              text: `Sorry, the thread is currently locked until ${thread.time.toLocaleString("en-US", { timeZone: "America/New_York", timeStyle: "short", dateStyle: "long" })} EST`,
            });

            await app.client.chat.delete({
              // Delete the chat message
              channel: message.channel,
              ts: message.ts,
              token: process.env.SLACK_USER_TOKEN,
            });
          }
        } else if (thread.active && thread.time < new Date()) {
          await app.client.chat.postMessage({
            channel: process.env.SLACK_LOG_CHANNEL,
            text: `🔓 Thread unlocked in <#${message.channel}>
Reason: Autounlock (triggered by message)
Admin: System
Link: https://hackclub.slack.com/archives/${thread.channel}/p${thread.id.toString().replace(".", "")}`,
          });

          await prisma.thread.update({
            // Delete record from database
            where: {
              id: message.thread_ts,
            },
            data: {
              active: false,
            },
          });

          await app.client.reactions.remove({
            // Remove lock reaction
            channel: message.channel,
            name: "lock",
            timestamp: message.thread_ts,
          });
        }
      } catch (e) {
        // Insufficent permissions, most likely.
        // An admin MUST authorise the bot.
        console.error(e);
      }
    });

    app.shortcut("lock_thread", async ({ ack, body, say, client, respond }) => {
      await ack();
      try {
        await app.client.conversations.join({
          channel: body.channel.id,
        });
      } catch (e) {}
      const user = await app.client.users.info({ user: body.user.id });

      if (!body.message.thread_ts)
        return await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "❌ This is not a thread",
        });
      if (!user.user.is_admin)
        return await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          thread_ts: body.message.thread_ts,
          text: "❌ Only admins can run this command.",
        });

      const thread = await prisma.thread.findFirst({
        // Look up in the database if it exists
        where: {
          id: body.message.thread_ts,
        },
      });
      if (!thread || !thread.active) {
        const modal = require("./utils/modal.json");

        return await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            ...require("./utils/modal.json"),
            callback_id: "lock_modal",
            private_metadata: JSON.stringify({
              thread_id: body.message.thread_ts,
              channel_id: body.channel.id,
            }),
          },
        });
      } else {
        await prisma.thread.update({
          // Update from database
          where: {
            id: body.message.thread_ts,
          },
          data: {
            active: false,
          },
        });

        await app.client.chat.postMessage({
          channel: process.env.SLACK_LOG_CHANNEL,
          text: `🔓 Thread unlocked in <#${body.channel.id}>
Reason: Admin clicked unlock.
Link: https://hackclub.slack.com/archives/${body.channel.id}/p${body.message.thread_ts.toString().replace(".", "")}`,
        });
        // Admin: <@${body.user.id}>
        try {
          await app.client.reactions.remove({
            // Remove lock reaction
            channel: body.channel.id,
            name: "lock",
            timestamp: body.message.thread_ts,
          });
        } catch (e) {}
      }
      return;
    });
  })();

  process.on("unhandledRejection", (error) => {
    console.error(error);
  });
}
