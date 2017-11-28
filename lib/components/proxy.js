/**
 * Component for proxy.
 * Generate proxies for rpc client.
 */
const crc = require('crc');
const utils = require('../util/utils');
const events = require('../util/events');
const Client = require('dreamix-rpc').client;
const pathUtil = require('../util/pathUtil');
const Constants = require('../util/constants');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

/**
 * Generate rpc client
 *
 * @param {Object} app current application context
 * @param {Object} opts contructor parameters for rpc client
 * @return {Object} rpc client
 */
function genRpcClient(app, opts) {
    opts.context = app;
    opts.routeContext = app;
    if (opts.rpcClient) {
        return opts.rpcClient.create(opts);
    }
    return Client.create(opts);
}

/**
 * Check a server whether has generated proxy before
 *
 * @param  {Object}  client rpc client instance
 * @param  {Object}  sinfo  server info
 * @return {Boolean}        true or false
 */
function hasProxy(client, sinfo) {
    const proxy = client.proxies;
    return !!proxy.sys && !!proxy.sys[sinfo.serverType];
}

/**
 * Get proxy path for rpc client.
 * Iterate all the remote service path and create remote path record.
 *
 * @param {Object} app current application context
 * @param {Object} sinfo server info, format: {id, serverType, host, port}
 * @return {Array}     remote path record array
 */
function getProxyRecords(app, sinfo) {
    const records = [];
    const appBase = app.getBase();
    let record;
    // sys remote service path record
    if (app.isFrontend(sinfo)) {
        record = pathUtil.getSysRemotePath('frontend');
    } else {
        record = pathUtil.getSysRemotePath('backend');
    }
    if (record) {
        records.push(pathUtil.remotePathRecord('sys', sinfo.serverType, record));
    }

    // user remote service path record
    record = pathUtil.getUserRemotePath(appBase, sinfo.serverType);
    if (record) {
        records.push(pathUtil.remotePathRecord('user', sinfo.serverType, record));
    }
    logger.debug('server [%s] sinfo = %j getProxyRecords %j', app.getServerId(), sinfo, records);
    return records;
}

/**
 * Generate proxy for the server infos.
 *
 * @param  {Object} client rpc client instance
 * @param  {Object} app    application context
 * @param  {Array} sinfos server info list
 */
function genProxies(client, app, sinfos) {
    let item;
    for (let i = 0, l = sinfos.length; i < l; i++) {
        item = sinfos[i];
        if (!hasProxy(client, item)) {
            client.addProxies(getProxyRecords(app, item));
        }
    }
}


function defaultRoute(session, msg, app, cb) {
    const list = app.getServersByType(msg.serverType);
    if (!list || !list.length) {
        cb(new Error(`can not find server info for type:${msg.serverType}`));
        return;
    }

    const uid = session ? (session.uid || '') : '';
    const index = Math.abs(crc.crc32(uid.toString())) % list.length;
    utils.invokeCallback(cb, null, list[index].id);
}

function genRouteFun() {
    return (session, msg, app, cb) => {
        const routes = app.get('__routes__');

        if (!routes) {
            defaultRoute(session, msg, app, cb);
            return;
        }

        const type = msg.serverType;
        const route = routes[type] || routes.default;

        if (route) {
            route(session, msg, app, cb);
        } else {
            defaultRoute(session, msg, app, cb);
        }
    };
}


/**
 * Proxy component class
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 */
class Component {
    constructor(app, opts) {
        this.app = app;
        this.opts = opts;
        this.client = genRpcClient(this.app, opts);
        this.app.on(events.ADD_SERVERS, this.addServers.bind(this));
        this.app.on(events.REMOVE_SERVERS, this.removeServers.bind(this));
        this.app.on(events.REPLACE_SERVERS, this.replaceServers.bind(this));
        this.app.rpc = {};
        this.app.sysrpc = {};
        this.name = '__proxy__';
    }

    /**
     * Proxy component lifecycle function
     *
     * @param {Function} cb
     */
    start(cb) {
        if (this.opts.enableRpcLog) {
            logger.warn('enableRpcLog is deprecated in 0.8.0, please use app.rpcFilter(dreamix.rpcFilters.rpcLog())');
        }
        const rpcBefores = this.app.get(Constants.KEYWORDS.RPC_BEFORE_FILTER);
        const rpcAfters = this.app.get(Constants.KEYWORDS.RPC_AFTER_FILTER);
        const rpcErrorHandler = this.app.get(Constants.RESERVED.RPC_ERROR_HANDLER);

        if (rpcBefores) {
            this.client.before(rpcBefores);
        }
        if (rpcAfters) {
            this.client.after(rpcAfters);
        }
        if (rpcErrorHandler) {
            this.client.setErrorHandler(rpcErrorHandler);
        }
        process.nextTick(cb);
    }

    /**
     * Component lifecycle callback
     *
     * @param {Function} cb
     */
    afterStart(cb) {
        this.app.rpc = this.client.proxies.user;
        this.app.sysrpc = this.client.proxies.sys;
        logger.debug('server [%s] afterStart and rpc client this.app.rpc = %j  this.app.sysrpc = %j this.client.proxies = %j', this.app.getServerId(), this.app.rpc, this.app.sysrpc, this.client.proxies);
        this.app.set('rpcInvoke', this.client.rpcInvoke.bind(this.client), true);
        this.client.start(cb);
    }

    /**
     * Add remote server to the rpc client.
     *
     * @param {Array} servers server info list, {id, serverType, host, port}
     */
    addServers(servers) {
        if (!servers || !servers.length) {
            return;
        }

        genProxies(this.client, this.app, servers);
        this.client.addServers(servers);
        logger.debug('server [%s] addServers %j this.app.rpc = %j this.app.sysrpc = %j this.client.proxies = %j', this.app.getServerId(), servers, this.app.rpc, this.app.sysrpc, this.client.proxies);
    }

    /**
     * Remove remote server from the rpc client.
     *
     * @param  {Array} ids server id list
     */
    removeServers(ids) {
        this.client.removeServers(ids);
    }

    /**
     * Replace remote servers from the rpc client.
     *
     * @param  {Array}servers ids server id list
     */
    replaceServers(servers) {
        if (!servers || !servers.length) {
            return;
        }

        // update proxies
        this.client.proxies = {};
        genProxies(this.client, this.app, servers);

        this.client.replaceServers(servers);
    }

    /**
     * Proxy for rpc client rpcInvoke.
     *
     * @param {String}   serverId remote server id
     * @param {Object}   msg      rpc message: {serverType: serverType, service: serviceName, method: methodName, args: arguments}
     * @param {Function} cb      callback function
     */
    rpcInvoke(serverId, msg, cb) {
        this.client.rpcInvoke(serverId, msg, cb);
    }
}


/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @param {Object} opts construct parameters
 *                      opts.router: (optional) rpc message route function, route(routeParam, msg, cb),
 *                      opts.mailBoxFactory: (optional) mail box factory instance.
 * @return {Object}     component instance
 */
module.exports = (app, opts) => {
    opts = opts || {};
    // proxy default config
    // cacheMsg is deprecated, just for compatibility here.
    opts.bufferMsg = opts.bufferMsg || opts.cacheMsg || false;
    opts.interval = opts.interval || 30;
    opts.router = genRouteFun();
    opts.context = app;
    opts.routeContext = app;
    if (app.enabled('rpcDebugLog')) {
        opts.rpcDebugLog = true;
        opts.rpcLogger = require('dreamix-logger').getLogger('rpc-debug', __filename); // eslint-disable-line
    }

    return new Component(app, opts);
};
