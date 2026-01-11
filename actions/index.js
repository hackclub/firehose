const path = require("path");

async function handleAction({ ack, event, client, body, say, action, respond, logger }) {
  try {
    const firstAction = body.actions[0];
    const viewId = body.view.callback_id
    const actionId = firstAction.action_id;
    const blockId = firstAction.block_id;

    console.log("action triggered:", actionId)
    const actionFile = path.resolve(__dirname, `${actionId}.js`);

    // Dynamically require action handlers
    const actionHandler = require(actionFile);
    if (actionHandler) {
      await actionHandler({ ack, event, client, body, say, action, respond, logger });
    } else {
      console.warn(`No handler found for action: ${actionId}`);
    }
  } catch (error) {
    console.error(`Error handling action ${body.actions[0].action_id}:`, error);
    if (ack) await ack();
  }
}

module.exports = handleAction;