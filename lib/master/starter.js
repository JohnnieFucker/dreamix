const cp = require('child_process');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

const util = require('util');
const utils = require('../util/utils');
const Constants = require('../util/constants');

let env = Constants.RESERVED.ENV_DEV;
const os = require('os');

const cpus = {};
const dreamix = require('../dreamix');


/**
 * Fork child process to run command.
 *
 * @param {String} command
 * @param {String} host
 * @param {Object} options
 * @param {Function} cb
 *
 */
function spawnProcess(command, host, options, cb) {
    let child = null;

    if (env === Constants.RESERVED.ENV_DEV) {
        child = cp.spawn(command, options);
        const prefix = command === Constants.COMMAND.SSH ? `[${host}] ` : '';

        child.stderr.on('data', (chunk) => {
            const msg = chunk.toString();
            process.stderr.write(msg);
            if (cb) {
                cb(msg);
            }
        });

        child.stdout.on('data', (chunk) => {
            const msg = prefix + chunk.toString();
            process.stdout.write(msg);
        });
    } else {
        child = cp.spawn(command, options, { detached: true, stdio: 'inherit' });
        child.unref();
    }

    child.on('exit', (code) => {
        if (code !== 0) {
            logger.warn('child process exit with error, error code: %s, executed command: %s', code, command);
        }
        if (typeof cb === 'function') {
            cb(code === 0 ? null : code);
        }
    });
}


const starter = {};
/**
 * Run all servers
 *
 * @param {Object} app current application  context
 */
starter.runServers = (app) => {
    let server;
    let servers;
    const condition = app.startId || app.type;
    switch (condition) {
    case Constants.RESERVED.MASTER:
        break;
    case Constants.RESERVED.ALL:
        servers = app.getServersFromConfig();
        for (const serverId in servers) {
            if (servers.hasOwnProperty(serverId)) {
                this.run(app, servers[serverId]);
            }
        }
        break;
    default:
        server = app.getServerFromConfig(condition);
        if (server) {
            this.run(app, server);
        } else {
            servers = app.get(Constants.RESERVED.SERVERS)[condition];
            for (let i = 0; i < servers.length; i++) {
                this.run(app, servers[i]);
            }
        }
    }
};

/**
 * Run server
 *
 * @param {Object} app current application context
 * @param {Object} server
 * @param {Function} cb
 */
starter.run = (app, server, cb) => {
    env = app.get(Constants.RESERVED.ENV);
    let cmd;
    let key;
    if (utils.isLocal(server.host)) {
        let options = [];
        if (server.args) {
            if (typeof server.args === 'string') {
                options.push(server.args.trim());
            } else {
                options = options.concat(server.args);
            }
        }
        cmd = app.get(Constants.RESERVED.MAIN);
        options.push(cmd);
        options.push(util.format('env=%s', env));
        for (key in server) {
            if (key === Constants.RESERVED.CPU) {
                cpus[server.id] = server[key];
            }
            options.push(util.format('%s=%s', key, server[key]));
        }
        starter.localrun(process.execPath, null, options, cb);
    } else {
        cmd = util.format('cd "%s" && "%s"', app.getBase(), process.execPath);
        const arg = server.args;
        if (arg !== undefined) {
            cmd += arg;
        }
        cmd += util.format(' "%s" env=%s ', app.get(Constants.RESERVED.MAIN), env);
        for (key in server) {
            if (key === Constants.RESERVED.CPU) {
                cpus[server.id] = server[key];
            }
            cmd += util.format(' %s=%s ', key, server[key]);
        }
        starter.sshrun(cmd, server.host, cb);
    }
};

/**
 * Bind process with cpu
 *
 * @param {String} sid server id
 * @param {String} pid process id
 * @param {String} host server host
 */
starter.bindCpu = (sid, pid, host) => {
    if (os.platform() === Constants.PLATFORM.LINUX && cpus[sid] !== undefined) {
        if (utils.isLocal(host)) {
            const options = [];
            options.push('-pc');
            options.push(cpus[sid]);
            options.push(pid);
            starter.localrun(Constants.COMMAND.TASKSET, null, options);
        } else {
            const cmd = util.format('taskset -pc "%s" "%s"', cpus[sid], pid);
            starter.sshrun(cmd, host, null);
        }
    }
};

/**
 * Kill application in all servers
 *
 * @param {String} pids  array of server's pid
 * @param {String} servers serverIds array of serverId
 */
starter.kill = (pids, servers) => {
    let cmd;
    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        if (utils.isLocal(server.host)) {
            const options = [];
            if (os.platform() === Constants.PLATFORM.WIN) {
                cmd = Constants.COMMAND.TASKKILL;
                options.push('/pid');
                options.push('/f');
            } else {
                cmd = Constants.COMMAND.KILL;
                options.push(-9);
            }
            options.push(pids[i]);
            starter.localrun(cmd, null, options);
        } else {
            if (os.platform() === Constants.PLATFORM.WIN) {
                cmd = util.format('taskkill /pid %s /f', pids[i]);
            } else {
                cmd = util.format('kill -9 %s', pids[i]);
            }
            starter.sshrun(cmd, server.host);
        }
    }
};

/**
 * Use ssh to run command.
 *
 * @param {String} cmd command that would be executed in the remote server
 * @param {String} host remote server host
 * @param {Function} cb callback function
 *
 */
starter.sshrun = (cmd, host, cb) => {
    let args = [];
    args.push(host);
    const sshParams = dreamix.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS);
    if (!!sshParams && Array.isArray(sshParams)) {
        args = args.concat(sshParams);
    }
    args.push(cmd);

    logger.info(`Executing ${cmd} on ${host}:22`);
    spawnProcess(Constants.COMMAND.SSH, host, args, cb);
};

/**
 * Run local command.
 *
 * @param {String} cmd
 * @param {String} host
 * @param {Object} options
 * @param {Function} callback
 *
 */
starter.localrun = (cmd, host, options, callback) => {
    logger.info(`Executing ${cmd} ${options} locally`);
    spawnProcess(cmd, host, options, callback);
};


module.exports = starter;
