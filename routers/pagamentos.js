var logger = require('../services/logger.js');

module.exports = function (app) {
    app.get('/pagamentos', function (req, res) {
        console.log('Recebida requisicao de teste.');
        logger.info('Recebida requisicao de teste.');
        res.send('OK.');
    });

    app.get('/pagamentos/pagamento/:id', function (req, res) {
        var id = req.params.id;
        console.log('consultando pagamento: ' + id);
        logger.info('consultando pagamento: ' + id);

        var memcachedClient = app.services.memcachedClient();
        memcachedClient.get('pagamento-' + id, function (erro, retorno) {
             if (erro || !retorno) {
                console.log('MISS - key not found');
                logger.error('MISS - key not found');
                var connection = app.persistence.connectionFactory();
                var pagamentoDAO = new app.persistence.PagamentoDAO(connection);

                pagamentoDAO.buscaPorId(id, function (erro, result) {
                     if (erro) {
                        console.log('erro ao consultar no banco ' + erro);
                        logger.error('erro ao consultar no banco ' + erro);
                        res.status(500).send(erro);
                        return;
                     }

                     console.log('pagamento encontrado: ' + JSON.stringify(result));
                     logger.info('pagamento encontrado: ' + JSON.stringify(result));
                     res.json(result);
                });
             } else {
                // HIT no cache
                console.log('HIT - value:' + JSON.stringify(retorno));
                logger.info('HIT - value:' + JSON.stringify(retorno));
                res.json(retorno);
             }
        });
    });

    app.delete('/pagamentos/pagamento/:id', function (req, res) {
        var id = req.params.id;

        var pagamento = {};
        pagamento.id = id;
        pagamento.status = 'CANCELADO';

        var connection = app.persistence.connectionFactory();
        var pagamentoDAO = new app.persistence.PagamentoDAO(connection);

        pagamentoDAO.atualiza(pagamento, function (err) {
            if (err) {
                console.log('erro ao cancelar pagamento', err);
                logger.error('erro ao cancelar pagamento', err);
                res.status(500).send(err);
                return;
            }

            console.log('pagamento cancelado');
            logger.info('pagamento cancelado');
            var memcachedClient = app.services.memcachedClient();
            memcachedClient.set('pagamento-' + pagamento.id, pagamento, 60000, function (erro) {
                console.log('[cancelado] nova chave adicionada ao cache: pagamento-' + pagamento.id);
            });
            res.status(204).send(pagamento);
        });
    });

    app.put('/pagamentos/pagamento/:id', function (req, res) {
        var id = req.params.id;

        var pagamento = {};
        pagamento.id = id;
        pagamento.status = 'CONFIRMADO';

        var connection = app.persistence.connectionFactory();
        var pagamentoDAO = new app.persistence.PagamentoDAO(connection);

        pagamentoDAO.atualiza(pagamento, function (err) {
            if (err) {
                console.log('erro ao atualizar pagamento', err);
                logger.error('erro ao atualizar pagamento', err);
                res.status(500).send(err);
                return;
            }

            console.log('pagamento confirmado');
            logger.info('pagamento confirmado');
            res.send(pagamento);

            var memcachedClient = app.services.memcachedClient();
            memcachedClient.set('pagamento-' + pagamento.id, pagamento, 60000, function (erro) {
                console.log('[confirmado] nova chave adicionada ao cache: pagamento-' + pagamento.id);
            });
        });
    });

    app.post('/pagamentos/pagamento', function (req, res) {
        req.assert('pagamento.forma_de_pagamento', 'Forma de Pagamento é obrigatório').notEmpty();
        req.assert('pagamento.valor', 'Valor é obrigatório e tem quer ser decimal').notEmpty().isFloat();
        var erros = req.validationErrors();
        if (erros) {
            console.log('Erros de validacao encontrados');
            logger.error('Erros de validacao encontrados');
            res.status(400).send(erros);
            return;
        }

        var pagamento = req.body['pagamento'];
        console.log('Processando requisicao de um novo pagamento');
        logger.info('Processando requisicao de um novo pagamento');

        pagamento.status = 'CRIADO';
        pagamento.data = new Date;

        var connection = app.persistence.connectionFactory();
        var pagamentoDAO = new app.persistence.PagamentoDAO(connection);

        pagamentoDAO.salva(pagamento, function (err, result) {
            if (err) {
                console.log('erro ao inserir no banco:', err);
                logger.error('erro ao inserir no banco:', err);
                res.status(500).send(err);
            } else {
                console.log('pagamento criado');
                logger.info('pagamento criado');
                pagamento.id = result.insertId;

                var memcachedClient = app.services.memcachedClient();
                memcachedClient.set('pagamento-' + pagamento.id, pagamento, 60000, function (erro) {
                    console.log('[criado] nova chave adicionada ao cache: pagamento-' + pagamento.id);
                });

                if (pagamento.forma_de_pagamento == 'cartao') {
                    var cartao = req.body['cartao'];
                    console.log(cartao);

                    var clienteCartoes = new app.services.clientesCartoes();
                    clienteCartoes.autoriza(cartao, function (error, request, response, retorno) {
                        if (error) {
                            console.log(error);
                            logger.error(error);
                            res.status(400).send(error);
                            return;
                        }

                        console.log(retorno);
                        logger.info('cartao autorizado');
                        res.location('/pagamentos/pagamento/' + pagamento.id);

                        var resultado = {
                            dados_do_pagamento : pagamento,
                            cartao : retorno,
                            links : [
                                {
                                    href : 'http://localhost:3000/pagamentos/pagamento/' + pagamento.id,
                                    rel : 'confirmar',
                                    method : 'PUT'
                                },
                                {
                                    href : 'http://localhost:3000/pagamentos/pagamento/' + pagamento.id,
                                    rel : 'cancelar',
                                    method : 'DELETE'
                                }
                            ]
                        };

                        res.status(201).json(resultado);
                        return;
                    });
                } else {

                    res.location('/pagamentos/pagamento/' + pagamento.id);

                    var response = {
                        dados_do_pagamento : pagamento,
                        links : [
                            {
                                href : 'http://localhost:3000/pagamentos/pagamento/' + pagamento.id,
                                rel : 'confirmar',
                                method : 'PUT'
                            },
                            {
                                href : 'http://localhost:3000/pagamentos/pagamento/' + pagamento.id,
                                rel : 'cancelar',
                                method : 'DELETE'
                            }
                        ]
                    };

                    res.status(201).json(response);
                }
            }
        });
    });
}