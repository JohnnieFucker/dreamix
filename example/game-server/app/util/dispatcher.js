const crc = require('crc');

module.exports.dispatch = (uid, servers) => {
    const serverArr = [];
    for (const key in servers) {
        if (servers.hasOwnProperty(key)) {
            serverArr.push(servers[key]);
        }
    }
    serverArr.sort((a, b) => a.id >= b.id);
    const index = Math.abs(crc.crc32(uid)) % servers.length;
    return serverArr[index];
};
