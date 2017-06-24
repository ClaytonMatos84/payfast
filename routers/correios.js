module.exports = function (app) {
    app.post('/correios/calculo-prazo', function (req, res) {
        var dadosDaEntrega = req.body;

        var correiosSOAPClient = new app.services.correiosSOAPClient();
        correiosSOAPClient.calculaPrazo(dadosDaEntrega, function (err, result) {
            if (err) {
                res.status(500).send(err);
                return;
            }

            console.log('prazo calculado');
            res.json(result);
        });
    });
}