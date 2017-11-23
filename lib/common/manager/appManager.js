const async = require('async');
const utils = require('../../util/utils');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const transactionLogger = require('dreamix-logger').getLogger('transaction-log', __filename);
const transactionErrorLogger = require('dreamix-logger').getLogger('transaction-error-log', __filename);

module.exports.transaction = (name, conditions, handlers, retry) => {
    if (!retry) {
        retry = 1;
    }
    if (typeof name !== 'string') {
        logger.error('transaction name is error format, name: %s.', name);
        return;
    }
    if (typeof conditions !== 'object' || typeof handlers !== 'object') {
        logger.error('transaction conditions parameter is error format, conditions: %j, handlers: %j.', conditions, handlers);
        return;
    }

    const cmethods = [];
    const dmethods = [];
    const cnames = [];
    const dnames = [];
    for (const key in conditions) {
        if (conditions.hasOwnProperty(key)) {
            if (typeof key !== 'string' || typeof conditions[key] !== 'function') {
                logger.error('transaction conditions parameter is error format, condition name: %s, condition function: %j.', key, conditions[key]);
                return;
            }
            cnames.push(key);
            cmethods.push(conditions[key]);
        }
    }

    let i = 0;
    // execute conditions
    async.forEachSeries(cmethods, (method, cb) => {
        method(cb);
        transactionLogger.info('[%s]:[%s] condition is executed.', name, cnames[i]);
        i++;
    }, (err) => {
        if (err) {
            process.nextTick(() => {
                transactionLogger.error('[%s]:[%s] condition is executed with err: %j.', name, cnames[--i], err.stack);
                const log = {
                    name: name,
                    method: cnames[i],
                    time: Date.now(),
                    type: 'condition',
                    description: err.stack
                };
                transactionErrorLogger.error(JSON.stringify(log));
            });
        } else {
            // execute handlers
            process.nextTick(() => {
                for (const key in handlers) {
                    if (handlers.hasOwnProperty(key)) {
                        if (typeof key !== 'string' || typeof handlers[key] !== 'function') {
                            logger.error('transcation handlers parameter is error format, handler name: %s, handler function: %j.', key, handlers[key]);
                            return;
                        }
                        dnames.push(key);
                        dmethods.push(handlers[key]);
                    }
                }

                let flag = true;
                const times = retry;

                // do retry if failed util retry times
                async.whilst(
                    () => retry > 0 && flag,
                    (callback) => {
                        let j = 0;
                        retry--;
                        async.forEachSeries(dmethods, (method, cb) => {
                            method(cb);
                            transactionLogger.info('[%s]:[%s] handler is executed.', name, dnames[j]);
                            j++;
                        }, (_err) => {
                            if (_err) {
                                process.nextTick(() => {
                                    transactionLogger.error('[%s]:[%s]:[%s] handler is executed with err: %j.', name, dnames[--j], times - retry, _err.stack);
                                    const log = {
                                        name: name,
                                        method: dnames[j],
                                        retry: times - retry,
                                        time: Date.now(),
                                        type: 'handler',
                                        description: _err.stack
                                    };
                                    transactionErrorLogger.error(JSON.stringify(log));
                                    utils.invokeCallback(callback);
                                });
                                return;
                            }
                            flag = false;
                            utils.invokeCallback(callback);
                            process.nextTick(() => {
                                transactionLogger.info('[%s] all conditions and handlers are executed successfully.', name);
                            });
                        });
                    },
                    (_err) => {
                        if (_err) {
                            logger.error('transaction process is executed with error: %j', _err);
                        }
                        // callback will not pass error
                    }
                );
            });
        }
    });
};
