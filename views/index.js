const path = require("path");

async function handleViews({ ack, logger, event, client, body, say }) {
  try {
    const viewId = body.view.callback_id;
    const bodyType = body.view.type;
    // const actionId = firstAction.action_id;
    // const blockId = firstAction.block_id;
    const viewFile = path.resolve(__dirname, `${viewId}.js`);

    // Dynamically require action handlers
    const viewHandler = require(viewFile);
    if (viewHandler) {
      await viewHandler({ event, client, body, say, ack, logger });
    } else {
      console.warn(`No handler found for view: ${viewId}`);
    }
  } catch (error) {
    console.error(`Error handling view ${body.view.callback_id}:`, error);
  }
}

module.exports = handleViews;
