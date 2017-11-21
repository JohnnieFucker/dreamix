const dispatcher = require('./dispatcher');

const exp = {};
exp.chat = (session, msg, app, cb) => {
    msg = msg.args[0].body;
    const uid = msg.uid;
    const servers = app.getServersByType('chat');

    if (!servers || servers.length === 0) {
        cb(new Error('can not find chat servers.'));
        return;
    }
    const res = dispatcher.dispatch(uid, servers);
    cb(null, res.id);
};

exp.connector = (session, msg, app, cb) => {
    msg = msg.args[0].body;
    const uid = msg.uid;

    const servers = app.getServersByType('connector');

    if (!servers || servers.length === 0) {
        cb(new Error('can not find connector servers.'));
        return;
    }
    const res = dispatcher.dispatch(uid, servers);
    cb(null, res.id);
};

module.exports = exp;
