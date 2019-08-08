const dreamix = require('../../dreamix');
const Package = require('dreamix-protocol').Package;

const CODE_OK = 200;
const CODE_USE_ERROR = 500;
const CODE_OLD_CLIENT = 501;

function setupHeartbeat(self) {
    return self.heartbeatSec;
}

function response(socket, sys, resp) {
    const res = {
        code: CODE_OK,
        sys: sys
    };
    if (resp) {
        res.user = resp;
    }
    socket.handshakeResponse(Package.encode(Package.TYPE_HANDSHAKE, new Buffer(JSON.stringify(res))));
}

function processError(socket, code) {
    const res = {
        code: code
    };
    socket.sendForce(Package.encode(Package.TYPE_HANDSHAKE, new Buffer(JSON.stringify(res))));
    process.nextTick(() => {
        socket.disconnect();
    });
}


/**
 * Process the handshake request.
 *
 * @param {Object} opts option parameters
 *                      opts.handshake(msg, cb(err, resp)) handshake callback. msg is the handshake message from client.
 *                      opts.hearbeat heartbeat interval (level?)
 *                      opts.version required client level
 */
class Command {
    constructor(opts) {
        opts = opts || {};
        this.userHandshake = opts.handshake; //心跳响应方法

        if (opts.heartbeat) {
            this.heartbeatSec = opts.heartbeat; //秒
            this.heartbeat = opts.heartbeat * 1000; //毫秒
        }

        this.checkClient = opts.checkClient;

        this.useDict = opts.useDict;
        this.useProtobuf = opts.useProtobuf;
        this.useCrypto = opts.useCrypto;
    }
    handle(socket, msg) {
        if (!msg.sys) {
            processError(socket, CODE_USE_ERROR);
            return;
        }

        if (typeof this.checkClient === 'function') {
            if (!msg || !msg.sys || !this.checkClient(msg.sys.type, msg.sys.version)) {
                processError(socket, CODE_OLD_CLIENT);
                return;
            }
        }

        const opts = {
            heartbeat: setupHeartbeat(this)
        };

        if (this.useDict) {
            const dictVersion = dreamix.app.components.__dictionary__.getVersion();
            if (!msg.sys.dictVersion || msg.sys.dictVersion !== dictVersion) {
                // may be deprecated in future
                opts.dict = dreamix.app.components.__dictionary__.getDict();

                opts.routeToCode = dreamix.app.components.__dictionary__.getDict();
                opts.codeToRoute = dreamix.app.components.__dictionary__.getAbbrs();
                opts.dictVersion = dictVersion;
            }
            opts.useDict = true;
        }

        if (this.useProtobuf) {
            const protoVersion = dreamix.app.components.__protobuf__.getVersion();
            if (!msg.sys.protoVersion || msg.sys.protoVersion !== protoVersion) {
                opts.protos = dreamix.app.components.__protobuf__.getProtos();
            }
            opts.useProto = true;
        }

        if (dreamix.app.components.__decodeIO__protobuf__) {
            if (this.useProtobuf) {
                throw new Error('protobuf can not be both used in the same project.');
            }
            const version = dreamix.app.components.__decodeIO__protobuf__.getVersion();
            if (!msg.sys.protoVersion || msg.sys.protoVersion < version) {
                opts.protos = dreamix.app.components.__decodeIO__protobuf__.getProtos();
            }
            opts.useProto = true;
        }

        if (this.useCrypto) {
            dreamix.app.components.__connector__.setPubKey(socket.id, msg.sys.rsa);
        }

        if (typeof this.userHandshake === 'function') {
            this.userHandshake(msg, (err, resp) => {
                if (err) {
                    process.nextTick(() => {
                        processError(socket, CODE_USE_ERROR);
                    });
                    return;
                }
                process.nextTick(() => {
                    response(socket, opts, resp);
                });
            }, socket);
            return;
        }

        process.nextTick(() => {
            response(socket, opts);
        });
    }
}

module.exports = Command;

