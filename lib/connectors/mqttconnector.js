const EventEmitter = require('events');
const mqtt = require('mqtt');
const constants = require('../util/constants');
const MQTTSocket = require('./mqttsocket');
const Adaptor = require('./mqtt/mqttadaptor');
const generate = require('./mqtt/generate');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

let curId = 1;


function composeResponse(msgId, route, msgBody) {
    return {
        id: msgId,
        body: msgBody
    };
}

function composePush(route, msgBody) {
    const msg = generate.publish(msgBody);
    if (!msg) {
        logger.error('invalid mqtt publish message: %j', msgBody);
    }

    return msg;
}
/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 */
class Connector extends EventEmitter {
    constructor(port, host, opts) {
        super();
        this.port = port;
        this.host = host;
        this.opts = opts || {};

        this.adaptor = new Adaptor(this.opts);
    }
    /**
     * Start connector to listen the specified port
     */
    start(cb) {
        const self = this;
        this.mqttServer = mqtt.createServer();
        this.mqttServer.on('client', (client) => {
            client.on('error', () => {
                client.stream.destroy();
            });

            client.on('close', () => {
                client.stream.destroy();
            });

            client.on('disconnect', () => {
                client.stream.destroy();
            });

            if (self.opts.disconnectOnTimeout) {
                const timeout = self.opts.timeout * 1000 || constants.TIME.DEFAULT_MQTT_HEARTBEAT_TIMEOUT;
                client.stream.setTimeout(timeout, () => {
                    client.emit('close');
                });
            }

            client.on('connect', () => {
                client.connack({ returnCode: 0 });
                const mqttsocket = new MQTTSocket(curId++, client, self.adaptor);
                self.emit('connection', mqttsocket);
            });
        });

        this.mqttServer.listen(this.port);

        process.nextTick(cb);
    }

    stop() {
        this.mqttServer.close();
        process.exit(0);
    }


    encode(reqId, route, msgBody) {// eslint-disable-line
        if (reqId) {
            return composeResponse(reqId, route, msgBody);
        }
        return composePush(route, msgBody);
    }

    close() {
        this.mqttServer.close();
    }
}
module.exports = Connector;
