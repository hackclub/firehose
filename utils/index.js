const { env } = require('./env');
const { getPrisma } = require('./prismaConnector');
const logging = require('./logging');
const slack = require('./slack');

module.exports = {
    env,
    getPrisma,
    ...logging,
    ...slack,
};
