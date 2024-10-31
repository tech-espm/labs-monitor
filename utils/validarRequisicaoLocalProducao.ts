import app = require("teem");
import appsettings = require("../appsettings");

export = function validarRequisicaoLocalProducao(req: app.Request, res: app.Response, chave?: string | null): boolean {
	if (appsettings.producao && req.headers["x-forwarded-for"]) {
		// Se chegar aqui, estava em produção, mas a requisição foi realizada por um IP externo
		res.status(400).json("Origem inválida");
		return false;
	}
	if (chave !== undefined && (!chave || !req.body || !req.body.k || req.body.k !== chave)) {
		res.status(400).json("Dados inválidos");
		return false;
	}
	return true;
};
