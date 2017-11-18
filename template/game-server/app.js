const dreamix = require('../../index');

/**
 * Init app for client.
 */
const app = dreamix.createApp();
app.set('name', 'dreamixServer');

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
            encodeMsg: false
        });
    app.filter(dreamix.timeout());
});
// start app
app.start(() => {
    console.log('【启动完成】');
});

process.on('uncaughtException', (err) => {
    console.error(` Caught exception: ${err.stack}`);
});

