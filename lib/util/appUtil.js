const async = require('async');
const log = require('./log');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const Constants = require('./constants');
const starter = require('../master/starter');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);


/**
 * Load server info from config/servers.json.
 */
function loadServers(app) {
    app.loadConfigBaseApp(Constants.RESERVED.SERVERS, Constants.FILEPATH.SERVER);
    const servers = app.get(Constants.RESERVED.SERVERS);
    const serverMap = {};
    let slist;
    let server;
    for (const serverType in servers) {
        if (servers.hasOwnProperty(serverType)) {
            slist = servers[serverType];
            for (let i = 0, l = slist.length; i < l; i++) {
                server = slist[i];
                server.serverType = serverType;
                if (server[Constants.RESERVED.CLUSTER_COUNT]) {
                    utils.loadCluster(app, server, serverMap);
                } else {
                    serverMap[server.id] = server;
                    if (server.wsPort) {
                        logger.warn('wsPort is deprecated, use clientPort in frontend server instead, server: %j', server);
                    }
                }
            }
        }
    }
    app.set(Constants.KEYWORDS.SERVER_MAP, serverMap);
}

/**
 * Load master info from config/master.json.
 */
function loadMaster(app) {
    app.loadConfigBaseApp(Constants.RESERVED.MASTER, Constants.FILEPATH.MASTER);
    app.master = app.get(Constants.RESERVED.MASTER);
}

/**
 * Process server start command
 */
function processArgs(app, args) {
    const serverType = args.serverType || Constants.RESERVED.MASTER;
    const serverId = args.id || app.getMaster().id;
    const mode = args.mode || Constants.RESERVED.CLUSTER;
    const masterha = args.masterha || 'false';
    const type = args.type || Constants.RESERVED.ALL;
    const startId = args.startId;

    app.set(Constants.RESERVED.MAIN, args.main, true);
    app.set(Constants.RESERVED.SERVER_TYPE, serverType, true);
    app.set(Constants.RESERVED.SERVER_ID, serverId, true);
    app.set(Constants.RESERVED.MODE, mode, true);
    app.set(Constants.RESERVED.TYPE, type, true);
    if (startId) {
        app.set(Constants.RESERVED.STARTID, startId, true);
    }

    if (masterha === 'true') {
        app.master = args;
        app.set(Constants.RESERVED.CURRENT_SERVER, args, true);
    } else if (serverType !== Constants.RESERVED.MASTER) {
        app.set(Constants.RESERVED.CURRENT_SERVER, args, true);
    } else {
        app.set(Constants.RESERVED.CURRENT_SERVER, app.getMaster(), true);
    }
}

/**
 * Setup enviroment.
 */
function setupEnv(app, args) {
    app.set(Constants.RESERVED.ENV, args.env || process.env.NODE_ENV || Constants.RESERVED.ENV_DEV, true);
}

/**
 * Configure custom logger.
 */
function configLogger(app) {
    if (process.env.DREAMIX_LOGGER !== 'off') {
        const env = app.get(Constants.RESERVED.ENV);
        const originPath = path.join(app.getBase(), Constants.FILEPATH.LOG);
        const presentPath = path.join(app.getBase(), Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.LOG));
        if (fs.existsSync(originPath)) {
            log.configure(app, originPath);
        } else if (fs.existsSync(presentPath)) {
            log.configure(app, presentPath);
        } else {
            logger.error('logger file path configuration is error.');
        }
    }
}

/**
 * Parse command line arguments.
 *
 * @param args command line arguments
 *
 * @return Object argsMap map of arguments
 */
function parseArgs(args) {
    const argsMap = {};
    let mainPos = 1;

    while (args[mainPos].indexOf('--') > 0) {
        mainPos++;
    }
    argsMap.main = args[mainPos];

    for (let i = (mainPos + 1); i < args.length; i++) {
        const arg = args[i];
        const sep = arg.indexOf('=');
        const key = arg.slice(0, sep);
        let value = arg.slice(sep + 1);
        if (!isNaN(Number(value)) && (value.indexOf('.') < 0)) {
            value = Number(value);
        }
        argsMap[key] = value;
    }

    return argsMap;
}

/**
 * Load lifecycle file.
 *
 */
function loadLifecycle(app) {
    const filePath = path.join(app.getBase(), Constants.FILEPATH.SERVER_DIR, app.serverType, Constants.FILEPATH.LIFECYCLE);
    if (!fs.existsSync(filePath)) {
        return;
    }
    const lifecycle = require(filePath);// eslint-disable-line
    for (const key in lifecycle) {
        if (lifecycle.hasOwnProperty(key)) {
            if (typeof lifecycle[key] === 'function') {
                app.lifecycleCbs[key] = lifecycle[key];
            } else {
                logger.warn('lifecycle.js in %s is error format.', filePath);
            }
        }
    }
}

/**
 * Initialize application configuration.
 */
module.exports.defaultConfiguration = (app) => {
    const args = parseArgs(process.argv);
    setupEnv(app, args);
    loadMaster(app);// 初始化master进程
    loadServers(app);// 初始化其他server进程
    processArgs(app, args);// 初始化app.settings的一些信息
    configLogger(app);// 读取log4js的配置文件配置dreamix-logger
    loadLifecycle(app);// 目前未用到
};

/**
 * Start servers by type.
 */
module.exports.startByType = (app, cb) => {
    if (app.startId) {
        if (app.startId === Constants.RESERVED.MASTER) {
            utils.invokeCallback(cb);
        } else {
            starter.runServers(app);
        }
    } else if (!!app.type && app.type !== Constants.RESERVED.ALL && app.type !== Constants.RESERVED.MASTER) {
        starter.runServers(app);
    } else {
        utils.invokeCallback(cb);
    }
};

/**
 * Load default components for application.
 */
module.exports.loadDefaultComponents = (app) => {
    const dreamix = require('../dreamix');  // eslint-disable-line
    // load system default components
    if (app.serverType === Constants.RESERVED.MASTER) {
        app.load(dreamix.master, app.get('masterConfig'));
    } else {
        app.load(dreamix.proxy, app.get('proxyConfig'));
        if (app.getCurServer().port) {
            app.load(dreamix.remote, app.get('remoteConfig'));
        }
        if (app.isFrontend()) {
            app.load(dreamix.connection, app.get('connectionConfig'));
            app.load(dreamix.connector, app.get('connectorConfig'));
            app.load(dreamix.session, app.get('sessionConfig'));
            // compatible for schedulerConfig
            if (app.get('schedulerConfig')) {
                app.load(dreamix.pushScheduler, app.get('schedulerConfig'));
            } else {
                app.load(dreamix.pushScheduler, app.get('pushSchedulerConfig'));
            }
        }
        app.load(dreamix.backendSession, app.get('backendSessionConfig'));
        app.load(dreamix.channel, app.get('channelConfig'));
        app.load(dreamix.server, app.get('serverConfig'));
    }
    app.load(dreamix.monitor, app.get('monitorConfig'));
};

/**
 * Stop components.
 *
 * @param  {Array}  comps component list
 * @param  {Number}   index current component index
 * @param  {Boolean}  force whether stop component immediately
 * @param  {Function} cb
 */
module.exports.stopComps = (comps, index, force, cb) => {
    if (index >= comps.length) {
        utils.invokeCallback(cb);
        return;
    }
    const comp = comps[index];
    if (typeof comp.stop === 'function') {
        comp.stop(force, () => {
            // ignore any error
            module.exports.stopComps(comps, index + 1, force, cb);
        });
    } else {
        module.exports.stopComps(comps, index + 1, force, cb);
    }
};

/**
 * Apply command to loaded components.
 * This method would invoke the component {method} in series.
 * Any component {method} return err, it would return err directly.
 *
 * @param {Array} comps loaded component list
 * @param {String} method component lifecycle method name, such as: start, stop
 * @param {Function} cb
 */
module.exports.optComponents = (comps, method, cb) => {
    let i = 0; // eslint-disable-line
    async.forEachSeries(comps, (comp, done) => {
        i++;
        if (typeof comp[method] === 'function') {
            comp[method](done);
        } else {
            done();
        }
    }, (err) => {
        if (err) {
            if (typeof err === 'string') {
                logger.error('fail to operate component, method: %s, err: %j', method, err);
            } else {
                logger.error('fail to operate component, method: %s, err: %j', method, err.stack);
            }
        }
        utils.invokeCallback(cb, err);
    });
};
