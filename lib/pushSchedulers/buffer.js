const utils = require('../util/utils');

const DEFAULT_FLUSH_INTERVAL = 20;

function onClose(self, session) {
    delete self.sessions[session.id];
}

function enqueue(self, session, msg) {
    let queue = self.sessions[session.id];
    if (!queue) {
        self.sessions[session.id] = [];
        queue = [];
        session.once('closed', onClose.bind(null, self));
    }

    queue.push(msg);
}

function doBroadcast(self, msg, opts) {
    const channelService = self.app.get('channelService');
    const sessionService = self.app.get('sessionService');

    if (opts.binded) {
        sessionService.forEachBindedSession((session) => {
            if (channelService.broadcastFilter &&
                !channelService.broadcastFilter(session, msg, opts.filterParam)) {
                return;
            }

            enqueue(self, session, msg);
        });
    } else {
        sessionService.forEachSession((session) => {
            if (channelService.broadcastFilter &&
                !channelService.broadcastFilter(session, msg, opts.filterParam)) {
                return;
            }

            enqueue(self, session, msg);
        });
    }
}

function doBatchPush(self, msg, recvs) {
    const sessionService = self.app.get('sessionService');
    let session;
    for (let i = 0, l = recvs.length; i < l; i++) {
        session = sessionService.get(recvs[i]);
        if (session) {
            enqueue(self, session, msg);
        }
    }
}


function flush(self) {
    const sessionService = self.app.get('sessionService');
    let queue;
    let session;
    for (const sid in self.sessions) {
        if (self.sessions.hasOwnProperty(sid)) {
            session = sessionService.get(sid);
            if (session) {
                queue = self.sessions[sid];
                if (queue && queue.length > 0) {
                    session.sendBatch(queue);
                    self.sessions[sid] = [];
                }
            }
        }
    }
}

class Service {
    constructor(app, opts) {
        opts = opts || {};
        this.app = app;
        this.flushInterval = opts.flushInterval || DEFAULT_FLUSH_INTERVAL;
        this.sessions = {}; // sid -> msg queue
        this.tid = null;
    }

    start(cb) {
        this.tid = setInterval(flush.bind(null, this), this.flushInterval);
        process.nextTick(() => {
            utils.invokeCallback(cb);
        });
    }

    stop(force, cb) {
        if (this.tid) {
            clearInterval(this.tid);
            this.tid = null;
        }
        process.nextTick(() => {
            utils.invokeCallback(cb);
        });
    }

    schedule(reqId, route, msg, recvs, opts, cb) {
        opts = opts || {};
        if (opts.type === 'broadcast') {
            doBroadcast(this, msg, opts.userOptions);
        } else {
            doBatchPush(this, msg, recvs);
        }

        process.nextTick(() => {
            utils.invokeCallback(cb);
        });
    }
}

module.exports = Service;

