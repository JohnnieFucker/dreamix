const utils = {};

/**
 * Check and invoke callback function
 */
utils.invokeCallback = (cb,...args) => {
    if (!!cb && typeof cb === 'function') {
        cb(...args);
    }
};

module.exports = utils;
