// This code was ai generated

const { WebClient } = require("@slack/web-api");
require("dotenv").config();

// Replace with your bot token
const token = process.env.SLACK_BOT_TOKEN; // Use an environment variable for security
const web = new WebClient(token);

async function countChannels() {
  try {
    let nextCursor; // Variable to handle pagination
    let hasMore = true; // Flag to check if there are more pages
    let totalChannelCount = 0; // Counter for total channels

    while (hasMore) {
      // Fetch the list of channels
      const result = await web.conversations.list({
        types: "public_channel", // You can change this to include 'private_channel' if needed
        cursor: nextCursor, // Use the cursor for pagination
        limit: 100, // Optional: set a limit for how many channels to return per request
      });

      const channels = result.channels || []; // Ensure channels is an array

      // Count the total number of channels
      totalChannelCount += channels.length;

      // Log the number of channels fetched in this batch
      console.log(`Fetched ${channels.length} channels in this batch.`);

      // Check if there are more channels to fetch
      nextCursor = result.response_metadata?.next_cursor;
      hasMore = Boolean(nextCursor); // Set hasMore based on the presence of next_cursor
    }

    console.log(`Total number of channels: ${totalChannelCount}`);
  } catch (error) {
    console.error("Error fetching channels:", error);
  }
}

// Run the function
countChannels();
