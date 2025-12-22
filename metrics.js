const { StatsD } = require("node-statsd");

const env = "production";
const graphite = process.env.GRAPHITE_HOST;

if (env.toLowerCase() == "production" && graphite == null) {
  throw new Error("Graphite is not working");
}

const options = {
  host: graphite,
  port: 8125,
  prefix: `${env}.channelmodtools.`,
};

const metrics = new StatsD(options);

module.exports = { metrics };
