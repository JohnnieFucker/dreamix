const Package = require('dreamix-protocol').Package;

module.exports.handle = (socket, reason) => {
// websocket close code 1000 would emit when client close the connection
    let res = {
        reason: 'serverKick'
    };
    if (typeof reason === 'string') {
        res.reason = reason;
    }
    socket.sendRaw(Package.encode(Package.TYPE_KICK, new Buffer(JSON.stringify(res))));
};
