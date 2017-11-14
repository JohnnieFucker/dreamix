const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const countDownLatch = require('../util/countDownLatch');
const utils = require('../util/utils');
const Constants = require('../util/constants');
const starter = require('../master/starter');
const exec = require('child_process').exec;

const moduleId = '__console__';


const ServerInfo = {
    host: 0,
    port: 0,
    id: 0,
    serverType: 0
};

const CronInfo = {
    id: 0,
    action: 0,
    time: 0
};

const RemoveCron = {
    id: 0
};

const ClusterInfo = {
    host: 0,
    port: 0,
    clusterCount: 0
};


function checkPort(server, cb) {
    if (!server.port && !server.clientPort) {
        utils.invokeCallback(cb, 'leisure');
        return;
    }

    let p = server.port || server.clientPort;
    const host = server.host;
    let cmd = 'netstat -tln | grep ';
    if (!utils.isLocal(host)) {
        cmd = `ssh ${host} ${cmd}`;
    }

    exec(cmd + p, (err, stdout, stderr) => {
        if (stdout || stderr) {
            utils.invokeCallback(cb, 'busy');
        } else {
            p = server.clientPort;
            exec(cmd + p, (_err, _stdout, _stderr) => {
                if (_stdout || _stderr) {
                    utils.invokeCallback(cb, 'busy');
                } else {
                    utils.invokeCallback(cb, 'leisure');
                }
            });
        }
    });
}

function runServer(app, server, cb) {
    checkPort(server, (status) => {
        if (status === 'busy') {
            utils.invokeCallback(cb, new Error('Port occupied already, check your server to add.'));
        } else {
            starter.run(app, server, (err) => {
                if (err) {
                    utils.invokeCallback(cb, new Error(err), null);
                }
            });
            process.nextTick(() => {
                utils.invokeCallback(cb, null, { status: 'ok' });
            });
        }
    });
}

function kill(app, agent, msg, cb) {
    let sid;
    let record;
    const serverIds = [];
    const count = utils.size(agent.idMap);
    const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_MASTER_KILL }, (isTimeout) => {
        if (!isTimeout) {
            utils.invokeCallback(cb, null, { code: 'ok' });
        } else {
            utils.invokeCallback(cb, null, { code: 'remained', serverIds: serverIds });
        }
        setTimeout(() => {
            process.exit(-1);
        }, Constants.TIME.TIME_WAIT_MONITOR_KILL);
    });

    const agentRequestCallback = (_msg) => {
        for (let i = 0; i < serverIds.length; ++i) {
            if (serverIds[i] === _msg) {
                serverIds.splice(i, 1);
                latch.done();
                break;
            }
        }
    };

    for (sid in agent.idMap) {
        if (agent.idMap.hasOwnProperty(sid)) {
            record = agent.idMap[sid];
            serverIds.push(record.id);
            agent.request(record.id, moduleId, { signal: msg.signal }, agentRequestCallback);
        }
    }
}

function stop(app, agent, msg, cb) {
    let serverIds = msg.ids;
    const servers = app.getServers();
    if (serverIds.length) {
        app.set(Constants.RESERVED.STOP_SERVERS, serverIds);
        for (let i = 0; i < serverIds.length; i++) {
            const serverId = serverIds[i];
            if (!servers[serverId]) {
                utils.invokeCallback(cb, new Error('Cannot find the server to stop.'), null);
            } else {
                agent.notifyById(serverId, moduleId, { signal: msg.signal });
            }
        }
        utils.invokeCallback(cb, null, { status: 'part' });
    } else {
        serverIds = [];
        for (const i in servers) {
            if (servers.hasOwnProperty(i)) {
                serverIds.push(i);
            }
        }
        app.set(Constants.RESERVED.STOP_SERVERS, serverIds);
        agent.notifyAll(moduleId, { signal: msg.signal });
        setTimeout(() => {
            app.stop(true);
            utils.invokeCallback(cb, null, { status: 'all' });
        }, Constants.TIME.TIME_WAIT_STOP);
    }
}

function restart(app, agent, msg, cb) {
    let successFlag;
    const successIds = [];
    const serverIds = msg.ids;
    const type = msg.type;
    let servers;
    if (!serverIds.length && !!type) {
        servers = app.getServersByType(type);
        if (!servers) {
            utils.invokeCallback(cb, new Error(`restart servers with unknown server type: ${type}`));
            return;
        }
        for (let i = 0; i < servers.length; i++) {
            serverIds.push(servers[i].id);
        }
    } else if (!serverIds.length) {
        servers = app.getServers();
        for (const key in servers) {
            if (servers.hasOwnProperty(key)) {
                serverIds.push(key);
            }
        }
    }
    const count = serverIds.length;
    const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_COUNTDOWN }, () => {
        if (!successFlag) {
            utils.invokeCallback(cb, new Error('all servers start failed.'));
            return;
        }
        utils.invokeCallback(cb, null, utils.arrayDiff(serverIds, successIds));
    });

    const request = id => (() => {
        agent.request(id, moduleId, { signal: msg.signal }, (_msg) => {
            if (!utils.size(_msg)) {
                latch.done();
                return;
            }
            setTimeout(() => {
                runServer(app, _msg, (err) => {
                    if (err) {
                        logger.error(`restart ${id} failed.`);
                    } else {
                        successIds.push(id);
                        successFlag = true;
                    }
                    latch.done();
                });
            }, Constants.TIME.TIME_WAIT_RESTART);
        });
    })();

    for (let j = 0; j < serverIds.length; j++) {
        request(serverIds[j]);
    }
}

function list(agent, msg, cb) {
    let sid;
    let record;
    const serverInfo = {};
    const count = utils.size(agent.idMap);
    const latch = countDownLatch.createCountDownLatch(count, { timeout: Constants.TIME.TIME_WAIT_COUNTDOWN }, () => {
        utils.invokeCallback(cb, null, { msg: serverInfo });
    });

    const callback = (_msg) => {
        serverInfo[_msg.serverId] = _msg.body;
        latch.done();
    };
    for (sid in agent.idMap) {
        if (agent.idMap.hasOwnProperty(sid)) {
            record = agent.idMap[sid];
            agent.request(record.id, moduleId, { signal: msg.signal }, callback);
        }
    }
}
function checkCluster(msg) {
    let flag = false;
    const args = msg.args;
    for (let i = 0; i < args.length; i++) {
        if (utils.startsWith(args[i], Constants.RESERVED.CLUSTER_COUNT)) {
            flag = true;
        }
    }
    return flag;
}

function isReady(info) {
    for (const key in info) {
        if (info.hasOwnProperty(key)) {
            if (info[key]) {
                return false;
            }
        }
    }
    return true;
}

function reset(info) {
    for (const key in info) {
        if (info.hasOwnProperty(key)) {
            info[key] = 0;
        }
    }
}
function parseArgs(msg, info, cb) {
    const rs = {};
    const args = msg.args;
    for (let i = 0; i < args.length; i++) {
        if (args[i].indexOf('=') < 0) {
            cb(new Error('Error server parameters format.'), null);
            return null;
        }
        const pairs = args[i].split('=');
        const key = pairs[0];
        if (info[key]) {
            info[key] = 1;
        }
        rs[pairs[0]] = pairs[1];
    }
    return rs;
}

function startCluster(app, msg, cb) {
    const serverMap = {};
    const fails = [];
    let successFlag;
    const serverInfo = parseArgs(msg, ClusterInfo, cb);
    utils.loadCluster(app, serverInfo, serverMap);
    const count = utils.size(serverMap);
    const latch = countDownLatch.createCountDownLatch(count, () => {
        if (!successFlag) {
            utils.invokeCallback(cb, new Error('all servers start failed.'));
            return;
        }
        utils.invokeCallback(cb, null, fails);
    });

    const start = server => (() => {
        checkPort(server, (status) => {
            if (status === 'busy') {
                fails.push(server);
                latch.done();
            } else {
                starter.run(app, server, (err) => {
                    if (err) {
                        fails.push(server);
                        latch.done();
                    }
                });
                process.nextTick(() => {
                    successFlag = true;
                    latch.done();
                });
            }
        });
    })();
    for (const key in serverMap) {
        if (serverMap.hasOwnProperty(key)) {
            const server = serverMap[key];
            start(server);
        }
    }
}
function startServer(app, msg, cb) {
    const server = parseArgs(msg, ServerInfo, cb);
    if (isReady(ServerInfo)) {
        runServer(app, server, cb);
    } else {
        cb(new Error('Miss necessary server parameters.'), null);
    }
}

function add(app, msg, cb) {
    if (checkCluster(msg)) {
        startCluster(app, msg, cb);
    } else {
        startServer(app, msg, cb);
    }
    reset(ServerInfo);
}

function sendCronInfo(cron, agent, msg, info, cb) {
    if (isReady(info) && (cron.serverId || cron.serverType)) {
        if (cron.serverId) {
            agent.notifyById(cron.serverId, module.exports.moduleId, { signal: msg.signal, cron: cron });
        } else {
            agent.notifyByType(cron.serverType, module.exports.moduleId, { signal: msg.signal, cron: cron });
        }
        process.nextTick(() => {
            cb(null, { status: 'ok' });
        });
    } else {
        cb(new Error('Miss necessary server parameters.'), null);
    }
    reset(info);
}

function addCron(app, agent, msg, cb) {
    const cron = parseArgs(msg, CronInfo, cb);
    sendCronInfo(cron, agent, msg, CronInfo, cb);
}

function removeCron(app, agent, msg, cb) {
    const cron = parseArgs(msg, RemoveCron, cb);
    sendCronInfo(cron, agent, msg, RemoveCron, cb);
}

function blacklist(agent, msg, cb) {
    const ips = msg.args;
    for (let i = 0; i < ips.length; i++) {
        if (!(new RegExp(/(\d+)\.(\d+)\.(\d+)\.(\d+)/g).test(ips[i]))) {
            utils.invokeCallback(cb, new Error(`blacklist ip: ${ips[i]} is error format.`), null);
            return;
        }
    }
    agent.notifyAll(module.exports.moduleId, { signal: msg.signal, blacklist: msg.args });
    process.nextTick(() => {
        cb(null, { status: 'ok' });
    });
}


class Module {
    constructor(opts) {
        opts = opts || {};
        this.app = opts.app;
        this.starter = opts.starter;
        this.moduleId = moduleId;
    }
    monitorHandler(agent, msg, cb) {
        const serverId = agent.id;
        switch (msg.signal) {
        case 'stop':
            if (agent.type === Constants.RESERVED.MASTER) {
                return;
            }
            this.app.stop(true);
            break;
        case 'list':   // eslint-disable-line
            const serverType = agent.type;
            const pid = process.pid;
            const heapUsed = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2);
            const rss = (process.memoryUsage().rss / (1024 * 1024)).toFixed(2);
            const heapTotal = (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(2);
            const uptime = (process.uptime() / 60).toFixed(2);
            utils.invokeCallback(cb, {
                serverId: serverId,
                body: { serverId: serverId, serverType: serverType, pid: pid, rss: rss, heapTotal: heapTotal, heapUsed: heapUsed, uptime: uptime }
            });
            break;
        case 'kill':
            utils.invokeCallback(cb, serverId);
            if (agent.type !== 'master') {
                setTimeout(() => {
                    process.exit(-1);
                }, Constants.TIME.TIME_WAIT_MONITOR_KILL);
            }
            break;
        case 'addCron':
            this.app.addCrons([msg.cron]);
            break;
        case 'removeCron':
            this.app.removeCrons([msg.cron]);
            break;
        case 'blacklist':
            if (this.app.isFrontend()) {
                const connector = this.app.components.__connector__;
                connector.blacklist = connector.blacklist.concat(msg.blacklist);
            }
            break;
        case 'restart':  // eslint-disable-line
            if (agent.type === Constants.RESERVED.MASTER) {
                return;
            }
            const self = this;
            const server = this.app.get(Constants.RESERVED.CURRENT_SERVER);
            utils.invokeCallback(cb, server);
            process.nextTick(() => {
                self.app.stop(true);
            });
            break;
        default:
            logger.error('receive error signal: %j', msg);
            break;
        }
    }

    clientHandler(agent, msg, cb) {
        const app = this.app;
        switch (msg.signal) {
        case 'kill':
            kill(app, agent, msg, cb);
            break;
        case 'stop':
            stop(app, agent, msg, cb);
            break;
        case 'list':
            list(agent, msg, cb);
            break;
        case 'add':
            add(app, msg, cb);
            break;
        case 'addCron':
            addCron(app, agent, msg, cb);
            break;
        case 'removeCron':
            removeCron(app, agent, msg, cb);
            break;
        case 'blacklist':
            blacklist(agent, msg, cb);
            break;
        case 'restart':
            restart(app, agent, msg, cb);
            break;
        default:
            utils.invokeCallback(cb, new Error('The command cannot be recognized, please check.'), null);
            break;
        }
    }
}


module.exports = opts => new Module(opts);
