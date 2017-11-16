/**
 * Component for master.
 */
const Master = require('../master/master');


/**
* Master component class
*
* @param {Object} app  current application context
*/
class Component {
    constructor(app, opts) {
        this.master = new Master(app, opts);
        this.name = '__master__';
    }

    /**
     * Component lifecycle function
     *
     * @param  {Function} cb
     */
    start(cb) {
        this.master.start(cb);
    }

    /**
     * Component lifecycle function
     *
     * @param  {Boolean}   force whether stop the component immediately
     * @param  {Function}  cb
     */
    stop(force, cb) {
        this.master.stop(cb);
    }
}

/**
 * Component factory function
 *
 * @param  {Object} app  current application context
 * @param  {Object} opts
 * @return {Object}      component instances
 */
module.exports = (app, opts) => new Component(app, opts);
