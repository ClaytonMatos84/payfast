var winston = require('winston');
var fs = require('fs');

if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

module.exports = new winston.Logger({
    transports : [
        new (winston.transports.File)({
            name : 'info',
            level : 'info',
            filename : 'logs/payfast-info.log',
            maxsize : 100000,
            maxfiles : 10
        }),
        new (winston.transports.File)({
            name : 'error',
            level : 'error',
            filename : 'logs/payfast-error.log',
            maxsize : 100000,
            maxfiles : 10
        })
    ]
});