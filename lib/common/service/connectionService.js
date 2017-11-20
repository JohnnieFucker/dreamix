/**
 * connection statistics service
 * record connection, login count and list
 */
class Service {
    constructor(app) {
        this.serverId = app.getServerId();
        this.connCount = 0;
        this.loginedCount = 0;
        this.logined = {};
    }


    /**
     * Add logined user.
     *
     * @param uid {String} user id
     * @param sid {String} session id
     * @param info {Object} record for logined user
     */
    addLoginedUser(uid, sid, info) {
        if (!this.logined[uid]) {
            this.loginedCount++;
        }
        info.uid = uid;
        info.sid = sid;
        this.logined[`${uid}_${sid}`] = info;
    }

    /**
     * Update user info.
     * @param uid {String} user id
     * @param sid {String} session id
     * @param info {Object} info for update.
     */
    updateUserInfo(uid, sid, info) {
        const user = this.logined[`${uid}_${sid}`];
        if (!user) {
            return;
        }

        for (const p in info) {
            if (info.hasOwnProperty(p) && typeof info[p] !== 'function') {
                user[p] = info[p];
            }
        }
    }

    /**
     * Increase connection count
     */
    increaseConnectionCount() {
        this.connCount++;
    }

    /**
     * Remote logined user
     *
     * @param uid {String} user id
     * @param sid {String} session id
     */
    removeLoginedUser(uid, sid) {
        if (this.logined[`${uid}_${sid}`]) {
            this.loginedCount--;
        }
        delete this.logined[`${uid}_${sid}`];
    }

    /**
     * Decrease connection count
     *
     * @param uid {String} uid
     * @param sid {String} session id
     */
    decreaseConnectionCount(uid, sid) {
        if (this.connCount) {
            this.connCount--;
        }
        if (uid) {
            this.removeLoginedUser(uid, sid);
        }
    }

    /**
     * Get statistics info
     *
     * @return {Object} statistics info
     */
    getStatisticsInfo() {
        const list = [];
        for (const uid in this.logined) {
            if (this.logined.hasOwnProperty(uid)) {
                list.push(this.logined[uid]);
            }
        }

        return { serverId: this.serverId, totalConnCount: this.connCount, loginedCount: this.loginedCount, loginedList: list };
    }
}

module.exports = Service;
