const os = require('os');
const admin = require('dreamix-admin');
const utils = require('./utils');
const Constants = require('./constants');
const pathUtil = require('./pathUtil');
const starter = require('../master/starter');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

const pro = {};

/**
 * Load admin modules
 */
pro.loadModules = (self, consoleService) => {
    // load app register modules
    const _modules = self.app.get(Constants.KEYWORDS.MODULE);

    if (!_modules) {
        return;
    }

    const modules = [];
    for (const m in _modules) {
        if (_modules.hasOwnProperty(m)) {
            modules.push(_modules[m]);
        }
    }

    let record;
    let moduleId;
    let module;
    for (let i = 0, l = modules.length; i < l; i++) {
        record = modules[i];
        if (typeof record.module === 'function') {
            module = record.module(record.opts, consoleService);
        } else {
            module = record.module;
        }

        moduleId = record.moduleId || module.moduleId;

        if (!moduleId) {
            logger.warn('ignore an unknown module.');
        } else {
            consoleService.register(moduleId, module);
            self.modules.push(module);
        }
    }
};

function startModule(err, modules, index, cb) {
    if (err || index >= modules.length) {
        utils.invokeCallback(cb, err);
        return;
    }

    const module = modules[index];
    if (module && typeof module.start === 'function') {
        module.start((_err) => {
            startModule(_err, modules, index + 1, cb);
        });
    } else {
        startModule(err, modules, index + 1, cb);
    }
}

pro.startModules = (modules, cb) => {
    // invoke the start lifecycle method of modules

    if (!modules) {
        return;
    }
    startModule(null, modules, 0, cb);
};

/**
 * Append the default system admin modules
 */
pro.registerDefaultModules = (isMaster, app, closeWatcher) => {
    if (!closeWatcher) {
        if (isMaster) {
            app.registerAdmin(require('../modules/masterwatcher'), { app: app }); // eslint-disable-line
        } else {
            app.registerAdmin(require('../modules/monitorwatcher'), { app: app }); // eslint-disable-line
        }
    }
    app.registerAdmin(admin.modules.watchServer, { app: app });
    app.registerAdmin(require('../modules/console'), { app: app, starter: starter });// eslint-disable-line
    if (app.enabled('systemMonitor')) {
        if (os.platform() !== Constants.PLATFORM.WIN) {
            app.registerAdmin(admin.modules.systemInfo);
            app.registerAdmin(admin.modules.nodeInfo);
        }
        app.registerAdmin(admin.modules.monitorLog, { path: pathUtil.getLogPath(app.getBase()) });
        app.registerAdmin(admin.modules.scripts, { app: app, path: pathUtil.getScriptPath(app.getBase()) });
        if (os.platform() !== Constants.PLATFORM.WIN) {
            app.registerAdmin(admin.modules.profiler);
        }
    }
};


module.exports = pro;
