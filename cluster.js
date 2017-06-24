var cluster = require('cluster');
var os = require('os');

var cpus = os.cpus();

console.log('executando thread');
if (cluster.isMaster) {
    console.log('thread master');

    cpus.forEach(function () {
        cluster.fork();
    });

    cluster.on('listening', function (worker) {
        console.log('novo cluster conectado ' + worker.process.pid);
    });

    cluster.on('disconnect', function (worker) {
        console.log('cluster %d desconectado', worker.process.pid);
    });

    cluster.on('exit', function (worker) {
        console.log('cluster %d perdido', worker.process.pid);
        cluster.fork();
    });

} else {
    console.log('thread slave');
    require('./index.js');
}