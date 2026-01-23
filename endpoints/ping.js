/** @param {import('express').Request} req @param {import('express').Response} res */
module.exports = async function ping(req, res) {
    res.json({ pong: true });
};
