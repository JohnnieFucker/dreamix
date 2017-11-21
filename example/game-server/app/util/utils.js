const PKG_ID_BYTES = 4;
const PKG_ROUTE_LENGTH_BYTES = 1;
const PKG_HEAD_BYTES = PKG_ID_BYTES + PKG_ROUTE_LENGTH_BYTES;

const utils = {};

/**
 * Check and invoke callback function
 */
utils.invokeCallback = (cb, ...args) => {
    if (!!cb && typeof cb === 'function') {
        cb(...args);
    }
};

function parseIntField(str, offset, len) {
    let res = 0;
    for (let i = 0; i < len; i++) {
        if (i > 0) {
            res <<= 8; // eslint-disable-line
        }
        res |= str.charCodeAt(offset + i) & 0xff; // eslint-disable-line
    }

    return res;
}

utils.connectorDecode = (msg) => {
    let index = 0;
    let id = '';
    let route = '';
    let body = '';
    if (msg.indexOf('_order_id') >= 0 && msg.indexOf('_route_str') >= 0) {
        const msgObj = JSON.parse(msg);
        id = msgObj._order_id;
        route = msgObj._route_str;
        delete msgObj._order_id;
        delete msgObj._route_str;
    } else {
        id = parseIntField(msg, index, PKG_ID_BYTES);
        index += PKG_ID_BYTES;
        const routeLen = parseIntField(msg, index, PKG_ROUTE_LENGTH_BYTES);
        route = msg.substr(PKG_HEAD_BYTES, routeLen);
        body = msg.substr(PKG_HEAD_BYTES + routeLen);
    }
    return {
        id: id,
        route: route,
        body: JSON.parse(body)
    };
};

module.exports = utils;
