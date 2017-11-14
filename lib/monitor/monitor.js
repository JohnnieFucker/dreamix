/**
 * Component for monitor.
 * Load and start monitor client.
 */
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const admin = require('dreamix-admin');
const moduleUtil = require('../util/moduleUtil');
const utils = require('../util/utils');
const Constants = require('../util/constants');

class Monitor {
    constructor(app, opts) {
        opts = opts || {};
        this.app = app;
        this.serverInfo = app.getCurServer();
        this.masterInfo = app.getMaster();
        this.modules = [];
        this.closeWatcher = opts.closeWatcher;

        this.monitorConsole = admin.createMonitorConsole({
            id: this.serverInfo.id,
            type: this.app.getServerType(),
            host: this.masterInfo.host,
            port: this.masterInfo.port,
            info: this.serverInfo,
            env: this.app.get(Constants.RESERVED.ENV),
            authServer: app.get('adminAuthServerMonitor') // auth server function
        });
    }
    start(cb) {
        moduleUtil.registerDefaultModules(false, this.app, this.closeWatcher);
        this.startConsole(cb);
    }

    startConsole(cb) {
        moduleUtil.loadModules(this, this.monitorConsole);

        const self = this;
        this.monitorConsole.start((err) => {
            if (err) {
                utils.invokeCallback(cb, err);
                return;
            }
            moduleUtil.startModules(self.modules, (_err) => {
                utils.invokeCallback(cb, _err);
            });
        });

        this.monitorConsole.on('error', (err) => {
            if (err) {
                logger.error('monitorConsole encounters with error: %j', err.stack);
            }
        });
    }

    stop(cb) {
        this.monitorConsole.stop();
        this.modules = [];
        process.nextTick(() => {
            utils.invokeCallback(cb);
        });
    }

    // monitor reconnect to master
    reconnect(masterInfo) {
        const self = this;
        this.stop(() => {
            self.monitorConsole = admin.createMonitorConsole({
                id: self.serverInfo.id,
                type: self.app.getServerType(),
                host: masterInfo.host,
                port: masterInfo.port,
                info: self.serverInfo,
                env: self.app.get(Constants.RESERVED.ENV)
            });
            self.startConsole(() => {
                logger.info('restart modules for server : %j finish.', self.app.serverId);
            });
        });
    }
}

module.exports = Monitor;

