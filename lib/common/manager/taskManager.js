const sequeue = require('seq-queue');

const manager = {};

const queues = {};

manager.timeout = 3000;

/**
 * Add tasks into task group. Create the task group if it dose not exist.
 *
 * @param {String}   key       task key
 * @param {Function} fn        task callback
 * @param {Function} ontimeout task timeout callback
 * @param {Number}   timeout   timeout for task
 */
manager.addTask = (key, fn, ontimeout, timeout) => {
    let queue = queues[key];
    if (!queue) {
        queue = sequeue.createQueue(manager.timeout);
        queues[key] = queue;
    }

    return queue.push(fn, ontimeout, timeout);
};

/**
 * Destroy task group
 *
 * @param  {String} key   task key
 * @param  {Boolean} force whether close task group directly
 */
manager.closeQueue = (key, force) => {
    if (!queues[key]) {
    // ignore illeagle key
        return;
    }

    queues[key].close(force);
    delete queues[key];
};

module.exports = manager;
