const dreamix = require('../../index');
const onlineUser = require('./app/modules/onlineUser');
const utils = require('./app/util/utils');
/**
 * Init app for client.
 */
const app = dreamix.createApp();
app.set('name', 'dreamixServer');

app.configure('all', () => {
    if (typeof app.registerAdmin === 'function') {
        app.registerAdmin(onlineUser, { app: app, interval: 5 * 60 });
    }
});

// app configuration
app.configure('all', 'connector', () => {
    app.set('connectorConfig',
        {
            connector: dreamix.connectors.sioconnector,
            // 'websocket', 'polling-xhr', 'polling-jsonp', 'polling'
            transports: ['websocket', 'polling-xhr', 'polling-jsonp', 'polling'],
            heartbeats: true,
            closeTimeout: 60 * 1000,
            heartbeatTimeout: 60 * 1000,
            heartbeatInterval: 25 * 1000,
            decode: utils.connectorDecode
        });
    app.set('proxyConfig', {
        bufferMsg: true,
        interval: 50
    });
    app.set('remoteConfig', {
        bufferMsg: true,
        interval: 50
    });
    app.filter(dreamix.timeout());
});

// 开启监控访问
app.enable('systemMonitor');

// start app
app.start(() => {
    console.log('【启动完成】');
});

process.on('uncaughtException', (err) => {
    console.error(` Caught exception: ${err.stack}`);
});

