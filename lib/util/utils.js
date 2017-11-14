const os = require('os');
const util = require('util');
const exec = require('child_process').exec;
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const Constants = require('./constants');
const dreamix = require('../dreamix');

const localIps = (() => {
    const ifaces = os.networkInterfaces();
    const ips = [];
    const func = (details) => {
        if (details.family === 'IPv4') {
            ips.push(details.address);
        }
    };
    for (const dev in ifaces) {
        if (ifaces.hasOwnProperty(dev)) {
            ifaces[dev].forEach(func);
        }
    }
    return ips;
})();

function inLocal(host) {
    for (const index in localIps) {
        if (localIps.hasOwnProperty(index)) {
            if (host === localIps[index]) {
                return true;
            }
        }
    }
    return false;
}

const utils = {};

/**
 * Invoke callback with check
 */
utils.invokeCallback = (cb, ...args) => {
    if (!!cb && typeof cb === 'function') {
        cb(...args);
    }
};

/**
 * Get the count of elements of object
 */
utils.size = (obj) => {
    let count = 0;
    for (const i in obj) {
        if (obj.hasOwnProperty(i) && typeof obj[i] !== 'function') {
            count++;
        }
    }
    return count;
};

/**
 * Check a string whether ends with another string
 */
utils.endsWith = (str, suffix) => {
    if (typeof str !== 'string' || typeof suffix !== 'string' || suffix.length > str.length) {
        return false;
    }
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

/**
 * Check a string whether starts with another string
 */
utils.startsWith = (str, prefix) => {
    if (typeof str !== 'string' || typeof prefix !== 'string' || prefix.length > str.length) {
        return false;
    }

    return str.indexOf(prefix) === 0;
};

/**
 * Compare the two arrays and return the difference.
 */
utils.arrayDiff = (array1, array2) => {
    const o = {};
    for (let i = 0, len = array2.length; i < len; i++) {
        o[array2[i]] = true;
    }

    const result = [];
    for (let i = 0, len = array1.length; i < len; i++) {
        const v = array1[i];
        if (!o[v]) {
            result.push(v);
        }
    }
    return result;
};

/*
 * Date format
 */
utils.format = (date, format) => {
    format = format || 'MMddhhmm';
    const o = {
        'M+': date.getMonth() + 1, // month
        'd+': date.getDate(), // day
        'h+': date.getHours(), // hour
        'm+': date.getMinutes(), // minute
        's+': date.getSeconds(), // second
        'q+': Math.floor((date.getMonth() + 3) / 3), // quarter
        S: date.getMilliseconds() // millisecond
    };

    if (/(y+)/.test(format)) {
        format = format.replace(RegExp.$1, (`${date.getFullYear()}`).substr(4 - RegExp.$1.length));
    }

    for (const k in o) {
        if (new RegExp(`(${k})`).test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] :
                (`00${o[k]}`).substr((`${o[k]}`).length));
        }
    }
    return format;
};

/**
 * check if has Chinese characters.
 */
utils.hasChineseChar = str => /.*[\u4e00-\u9fa5]+.*$/.test(str);

/**
 * transform unicode to utf8
 */
utils.unicodeToUtf8 = (str) => {
    let i;
    let ch;
    let utf8Str = '';
    const len = str.length;
    for (i = 0; i < len; i++) {
        ch = str.charCodeAt(i);

        if ((ch >= 0x0) && (ch <= 0x7F)) {
            utf8Str += str.charAt(i);
        } else if ((ch >= 0x80) && (ch <= 0x7FF)) {
            utf8Str += String.fromCharCode(0xc0 | ((ch >> 6) & 0x1F));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | (ch & 0x3F));   // eslint-disable-line
        } else if ((ch >= 0x800) && (ch <= 0xFFFF)) {
            utf8Str += String.fromCharCode(0xe0 | ((ch >> 12) & 0xF));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | (ch & 0x3F));        // eslint-disable-line
        } else if ((ch >= 0x10000) && (ch <= 0x1FFFFF)) {
            utf8Str += String.fromCharCode(0xF0 | ((ch >> 18) & 0x7));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3F));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3F));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | (ch & 0x3F));     // eslint-disable-line
        } else if ((ch >= 0x200000) && (ch <= 0x3FFFFFF)) {
            utf8Str += String.fromCharCode(0xF8 | ((ch >> 24) & 0x3));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 18) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3F));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | (ch & 0x3F));          // eslint-disable-line
        } else if ((ch >= 0x4000000) && (ch <= 0x7FFFFFFF)) {
            utf8Str += String.fromCharCode(0xFC | ((ch >> 30) & 0x1));    // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 24) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 18) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3F));   // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3F));  // eslint-disable-line
            utf8Str += String.fromCharCode(0x80 | (ch & 0x3F));    // eslint-disable-line
        }
    }
    return utf8Str;
};

/**
 * Ping server to check if network is available
 *
 */
utils.ping = (host, cb) => {
    if (!module.exports.isLocal(host)) {
        const cmd = `ping -w 15 ${host}`;
        exec(cmd, (err) => {
            if (err) {
                cb(false);
                return;
            }
            cb(true);
        });
    } else {
        cb(true);
    }
};

/**
 * Check if server is exsit.
 *
 */
utils.checkPort = (server, cb) => {
    if (!server.port && !server.clientPort) {
        this.invokeCallback(cb, 'leisure');
        return;
    }
    const self = this;
    let port = server.port || server.clientPort;
    const host = server.host;
    const generateCommand = (_self, _host, _port) => {
        let cmd;
        let sshParams = dreamix.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS);
        if (!!sshParams && Array.isArray(sshParams)) {
            sshParams = sshParams.join(' ');
        } else {
            sshParams = '';
        }
        if (!_self.isLocal(host)) {
            cmd = util.format('ssh %s %s "netstat -an|awk \'{print $4}\'|grep %s|wc -l"', _host, sshParams, _port);
        } else {
            cmd = util.format('netstat -an|awk \'{print $4}\'|grep %s|wc -l', _port);
        }
        return cmd;
    };
    const cmd1 = generateCommand(self, host, port);

    exec(cmd1, (err, stdout) => {
        if (err) {
            logger.error('command %s execute with error: %j', cmd1, err.stack);
            self.invokeCallback(cb, 'error');
        } else if (stdout.trim() !== '0') {
            self.invokeCallback(cb, 'busy');
        } else {
            port = server.clientPort;
            const cmd2 = generateCommand(self, host, port);
            exec(cmd2, (_err, _stdout) => {
                if (_err) {
                    logger.error('command %s execute with error: %j', cmd2, _err.stack);
                    self.invokeCallback(cb, 'error');
                } else if (_stdout.trim() !== '0') {
                    self.invokeCallback(cb, 'busy');
                } else {
                    self.invokeCallback(cb, 'leisure');
                }
            });
        }
    });
};

utils.isLocal = (host) => {
    const app = require('../dreamix').app;// eslint-disable-line
    if (!app) {
        return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || inLocal(host);
    }
    return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || inLocal(host) || host === app.master.host;
};

/**
 * Load cluster server.
 *
 */
utils.loadCluster = (app, server, serverMap) => {
    const increaseFields = {};
    const count = parseInt(server[Constants.RESERVED.CLUSTER_COUNT], 10);
    let seq = app.clusterSeq[server.serverType];
    if (!seq) {
        seq = 0;
        app.clusterSeq[server.serverType] = count;
    } else {
        app.clusterSeq[server.serverType] = seq + count;
    }

    for (const key in server) {
        if (server.hasOwnProperty(key)) {
            const value = server[key].toString();
            if (value.indexOf(Constants.RESERVED.CLUSTER_SIGNAL) > 0) {
                increaseFields[key] = server[key].slice(0, -2);
            }
        }
    }

    const clone = (src) => {
        const rs = {};
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                rs[key] = src[key];
            }
        }
        return rs;
    };
    for (let i = 0, l = seq; i < count; i++, l++) {
        const cserver = clone(server);
        cserver.id = `${Constants.RESERVED.CLUSTER_PREFIX + server.serverType}-${l}`;
        for (const k in increaseFields) {
            if (increaseFields.hasOwnProperty(k)) {
                const v = parseInt(increaseFields[k], 10);
                cserver[k] = v + i;
            }
        }
        serverMap[cserver.id] = cserver;
    }
};

utils.extends = (origin, add) => {
    if (!add || !this.isObject(add)) return origin;

    const keys = Object.keys(add);
    let i = keys.length;
    while (i--) {
        origin[keys[i]] = add[keys[i]];
    }
    return origin;
};

utils.headHandler = (headBuffer) => {
    let len = 0;
    for (let i = 1; i < 4; i++) {
        if (i > 1) {
            len <<= 8;    // eslint-disable-line
        }
        len += headBuffer.readUInt8(i);
    }
    return len;
};


utils.isObject = arg => typeof arg === 'object' && arg !== null;

module.exports = utils;
