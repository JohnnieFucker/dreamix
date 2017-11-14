const Message = require('pomelo-protocol').Message;
const Constants = require('../../util/constants');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

function encodeBody(server, route, msgBody) {
    // encode use protobuf
    if (!!server.protobuf && !!server.protobuf.getProtos().server[route]) {
        msgBody = server.protobuf.encode(route, msgBody);
    } else if (!!server.decodeIO_protobuf && !!server.decodeIO_protobuf.check(Constants.RESERVED.SERVER, route)) {
        msgBody = server.decodeIO_protobuf.encode(route, msgBody);
    } else {
        msgBody = new Buffer(JSON.stringify(msgBody), 'utf8');
    }
    return msgBody;
}

function composeResponse(server, msgId, route, msgBody) {
    if (!msgId || !route || !msgBody) {
        return null;
    }
    msgBody = encodeBody(server, route, msgBody);
    return Message.encode(msgId, Message.TYPE_RESPONSE, 0, null, msgBody);
}

function composePush(server, route, msgBody) {
    if (!route || !msgBody) {
        return null;
    }
    msgBody = encodeBody(server, route, msgBody);
    // encode use dictionary
    let compressRoute = 0;
    if (server.dictionary) {
        const dict = server.dictionary.getDict();
        if (!!server.connector.useDict && !!dict[route]) {
            route = dict[route];
            compressRoute = 1;
        }
    }
    return Message.encode(0, Message.TYPE_PUSH, compressRoute, route, msgBody);
}


function encode(reqId, route, msg) {
    if (reqId) {
        return composeResponse(this, reqId, route, msg);
    }
    return composePush(this, route, msg);
}

function decode(msg) {
    msg = Message.decode(msg.body);
    let route = msg.route;

    // decode use dictionary
    if (msg.compressRoute) {
        if (this.connector.useDict) {
            const abbrs = this.dictionary.getAbbrs();
            if (!abbrs[route]) {
                logger.error('dictionary error! no abbrs for route : %s', route);
                return null;
            }
            msg.route = abbrs[route];
            route = abbrs[route];
        } else {
            logger.error('fail to uncompress route code for msg: %j, server not enable dictionary.', msg);
            return null;
        }
    }

    // decode use protobuf
    if (!!this.protobuf && !!this.protobuf.getProtos().client[route]) {
        msg.body = this.protobuf.decode(route, msg.body);
    } else if (!!this.decodeIO_protobuf && !!this.decodeIO_protobuf.check(Constants.RESERVED.CLIENT, route)) {
        msg.body = this.decodeIO_protobuf.decode(route, msg.body);
    } else {
        try {
            msg.body = JSON.parse(msg.body.toString('utf8'));
        } catch (ex) {
            msg.body = {};
        }
    }

    return msg;
}


module.exports = {
    encode: encode,
    decode: decode
};
