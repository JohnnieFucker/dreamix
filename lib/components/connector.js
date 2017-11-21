const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const taskManager = require('../common/manager/taskManager');
const dreamix = require('../dreamix');
const rsa = require('node-bignumber');
const eventsConstants = require('../util/events');
const utils = require('../util/utils');

function getDefaultConnector(app, opts) {
    const DefaultConnector = require('../connectors/sioconnector'); // eslint-disable-line
    const curServer = app.getCurServer();
    return new DefaultConnector(curServer.clientPort, curServer.host, opts);
}

function getConnector(app, opts) {
    const Connector = opts.connector;
    if (!Connector) {
        return getDefaultConnector(app, opts);
    }
    if (typeof Connector !== 'function') {
        return Connector;
    }

    const curServer = app.getCurServer();
    return new Connector(curServer.clientPort, curServer.host, opts);
}


function hostFilter(cb, socket) {
    const ip = socket.remoteAddress.ip;
    const check = (list) => {
        for (const address in list) {
            if (list.hasOwnProperty(address)) {
                const exp = new RegExp(list[address]);
                if (exp.test(ip)) {
                    socket.disconnect();
                    return true;
                }
            }
        }
        return false;
    };
    // dynamical check
    if (this.blacklist.length !== 0 && !!check(this.blacklist)) {
        return;
    }
    // static check
    if (!!this.blacklistFun && typeof this.blacklistFun === 'function') {
        const self = this;
        self.blacklistFun((err, list) => {
            if (err) {
                logger.error('connector blacklist error: %j', err.stack);
                utils.invokeCallback(cb, self, socket);
                return;
            }
            if (!Array.isArray(list)) {
                logger.error('connector blacklist is not array: %j', list);
                utils.invokeCallback(cb, self, socket);
                return;
            }
            if (!check(list)) {
                utils.invokeCallback(cb, self, socket);
            }
        });
    } else {
        utils.invokeCallback(cb, this, socket);
    }
}

function onSessionClose(app, session) {
    taskManager.closeQueue(session.id, true);
    app.emit(eventsConstants.CLOSE_SESSION, session);
}

/**
 * get session for current connection
 */
function getSession(self, socket) {
    const app = self.app;
    const sid = socket.id;
    let session = self.session.get(sid);
    if (session) {
        return session;
    }
    // 创建frontEndSession
    session = self.session.create(sid, app.getServerId(), socket);
    logger.debug('[%s] getSession session is created with session id: %s', app.getServerId(), sid);

    // bind events for session
    socket.on('disconnect', session.closed.bind(session));
    socket.on('error', session.closed.bind(session));
    session.on('closed', onSessionClose.bind(null, app, session));
    session.on('bind', (uid) => {
        logger.debug('session on [%s] bind with uid: %s', self.app.serverId, uid);
        // update connection statistics if necessary
        if (self.connection) {
            self.connection.addLoginedUser(uid, sid, {
                lt: Date.now(),
                uid: uid,
                ip: `${socket.remoteAddress ? socket.remoteAddress : ''}`
            });
        }
        self.app.emit(eventsConstants.BIND_SESSION, session);
    });

    // 增加更新userInfo事件
    session.on('updateUserInfo', (info) => {
        logger.debug('session sid:%s on [%s] update user info with info: %j', sid, self.app.serverId, info);
        // update connection statistics if necessary
        if (self.connection) {
            self.connection.updateUserInfo(session.uid, sid, info);
        }
        /**
         * 绑定的用户信息如下
         *  { lt: 1511148484010,  登录时间
         *    uid: 'uid123',用户id
         *    ip: '',用户地址
         *    sid: 1,  session id
         *    uname: '测试账号1', 用户名称
         *    cid: 'cid345', 组织名称
         *    os: 'web',客户端类型
         *    cv: '1.0' } 客户端版本号
         */
        // self.app.emit(eventsConstants.BIND_SESSION, session);
    });


    session.on('unbind', (uid) => {
        if (self.connection) {
            self.connection.removeLoginedUser(uid, sid);
        }
        self.app.emit(eventsConstants.UNBIND_SESSION, session);
    });

    return session;
}

function verifyMessage(self, session, msg) {
    const sig = msg.body.__crypto__;
    if (!sig) {
        logger.error('receive data from client has no signature [%s]', self.app.serverId);
        return false;
    }

    let pubKey;

    if (!session) {
        logger.error('could not find session.');
        return false;
    }

    if (!session.get('pubKey')) {
        pubKey = self.getPubKey(session.id);
        if (pubKey) {
            delete self.keys[session.id];
            session.set('pubKey', pubKey);
        } else {
            logger.error('could not get public key, session id is %s', session.id);
            return false;
        }
    } else {
        pubKey = session.get('pubKey');
    }

    if (!pubKey.n || !pubKey.e) {
        logger.error('could not verify message without public key [%s]', self.app.serverId);
        return false;
    }

    delete msg.body.__crypto__;

    let message = JSON.stringify(msg.body);
    if (utils.hasChineseChar(message)) {
        message = utils.unicodeToUtf8(message);
    }

    return pubKey.verifyString(message, sig);
}

/**
 * Get server type form request message.
 */
function checkServerType(route) {
    if (!route) {
        return null;
    }
    const idx = route.indexOf('.');
    if (idx < 0) {
        return null;
    }
    return route.substring(0, idx);
}

function handleMessage(self, session, msg) {
    logger.debug('[%s] handleMessage session id: %s, msg: %j', self.app.serverId, session.id, msg);
    const type = checkServerType(msg.route);
    if (!type) {
        logger.error('invalid route string. route : %j', msg.route);
        return;
    }

    // session 转成frontendSession传给后端服务。
    self.server.globalHandle(msg, session.toFrontendSession(), (err, resp, opts) => {
        if (resp && !msg.id) {
            logger.warn('try to response to a notify: %j', msg.route);
            return;
        }
        if (!msg.id && !resp) return;
        if (!resp) resp = {};
        if (!!err && !resp.code) {
            resp.code = 500;
        }
        opts = { type: 'response', userOptions: opts || {} };
        // for compatiablity
        opts.isResponse = true;

        self.send(msg.id, msg.route, resp, [session.id], opts,
            () => {
            });
    });
}


function bindEvents(self, socket) {
    if (self.connection) {
        self.connection.increaseConnectionCount();
        const statisticInfo = self.connection.getStatisticsInfo();
        const curServer = self.app.getCurServer();
        if (statisticInfo.totalConnCount > curServer['max-connections']) {
            logger.warn('the server %s has reached the max connections %s', curServer.id, curServer['max-connections']);
            socket.disconnect();
            return;
        }
    }

    // create session for connection
    const session = getSession(self, socket);
    let closed = false;

    socket.on('disconnect', () => {
        if (closed) {
            return;
        }
        closed = true;
        if (self.connection) {
            self.connection.decreaseConnectionCount(session.uid, session.id);
        }
    });

    socket.on('error', () => {
        if (closed) {
            return;
        }
        closed = true;
        if (self.connection) {
            self.connection.decreaseConnectionCount(session.uid, session.id);
        }
    });

    // new message
    socket.on('message', (msg) => {
        let dmsg = msg;

        if (self.decode) {
            dmsg = self.decode.call(self, msg, session);
        } else if (self.connector.decode) {
            dmsg = self.connector.decode(msg);
        }
        if (!dmsg) {
            // discard invalid message
            return;
        }

        // use rsa crypto
        if (self.useCrypto) {
            const verified = verifyMessage(self, session, dmsg);
            if (!verified) {
                logger.error('fail to verify the data received from client.');
                return;
            }
        }

        handleMessage(self, session, dmsg);
    }); // on message end
}


/**
 * Connector component. Receive client requests and attach session with socket.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 *                      opts.connector {Object} provides low level network and protocol details implementation between server and clients.
 */
class Component {
    constructor(app, opts) {
        opts = opts || {};
        this.app = app;
        this.connector = getConnector(app, opts);
        this.encode = opts.encode;
        this.decode = opts.decode;
        this.useCrypto = opts.useCrypto;
        this.blacklistFun = opts.blacklistFun;
        this.keys = {};
        this.blacklist = [];

        if (opts.useDict) {
            app.load(dreamix.dictionary, app.get('dictionaryConfig'));
        }

        if (opts.useProtobuf) {
            app.load(dreamix.protobuf, app.get('protobufConfig'));
        }

        // component dependencies
        this.server = null;
        this.session = null;
        this.connection = null;
        this.name = '__connector__';
    }

    start(cb) {
        this.server = this.app.components.__server__;
        this.session = this.app.components.__session__;
        this.connection = this.app.components.__connection__;

        // check component dependencies
        if (!this.server) {
            process.nextTick(() => {
                utils.invokeCallback(cb, new Error('fail to start connector component for no server component loaded'));
            });
            return;
        }

        if (!this.session) {
            process.nextTick(() => {
                utils.invokeCallback(cb, new Error('fail to start connector component for no session component loaded'));
            });
            return;
        }

        process.nextTick(cb);
    }

    afterStart(cb) {
        this.connector.start(cb);
        this.connector.on('connection', hostFilter.bind(this, bindEvents));
    }

    stop(force, cb) {
        if (this.connector) {
            this.connector.stop(force, cb);
            this.connector = null;
            return;
        }
        process.nextTick(cb);
    }

    send(reqId, route, msg, recvs, opts, cb) {
        logger.debug('[%s] send message reqId: %s, route: %s, msg: %j, receivers: %j, opts: %j', this.app.serverId, reqId, route, msg, recvs, opts);
        let emsg = msg;

        if (this.encode) {
            // use costumized encode
            emsg = this.encode.call(this, reqId, route, msg);
        } else if (this.connector.encode) {
            // use connector default encode
            emsg = this.connector.encode(reqId, route, msg);
        }

        if (!emsg) {
            process.nextTick(() => {
                utils.invokeCallback(cb, new Error('fail to send message for encode result is empty.'));
            });
        }
        this.app.components.__pushScheduler__.schedule(reqId, route, emsg, recvs, opts, cb);
    }

    setPubKey(id, key) {
        const pubKey = new rsa.Key();
        pubKey.n = new rsa.BigInteger(key.rsa_n, 16);
        pubKey.e = key.rsa_e;
        this.keys[id] = pubKey;
    }

    getPubKey(id) {
        return this.keys[id];
    }
}

module.exports = (app, opts) => new Component(app, opts);
