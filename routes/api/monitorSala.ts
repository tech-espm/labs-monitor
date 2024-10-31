import app = require("teem");
import Perfil = require("../../enums/perfil");
import MonitorSala = require("../../models/monitorSala");
import Usuario = require("../../models/usuario");
import validarRequisicaoLocalProducao = require("../../utils/validarRequisicaoLocalProducao");

class MonitorSalaApiRoute {
	@app.http.post()
	public static iniciarAcessoProfessor(req: app.Request, res: app.Response) {
		if (!validarRequisicaoLocalProducao(req, res))
			return;

		const erro = MonitorSala.iniciarAcessoProfessor(req.body);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static iniciarAcessoEstudante(req: app.Request, res: app.Response) {
		if (!validarRequisicaoLocalProducao(req, res))
			return;

		const erro = MonitorSala.iniciarAcessoEstudante(req.body);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static listarEstudantes(req: app.Request, res: app.Response) {
		res.json(MonitorSala.listarEstudantes(req.body));
	}

	@app.http.post()
	public static excluirEstudante(req: app.Request, res: app.Response) {
		const erro = MonitorSala.excluirEstudante(req.body);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	@app.route.formData()
	public static enviarTela(req: app.Request, res: app.Response) {
		const erro = MonitorSala.enviarTela(req.body, req.uploadedFiles && req.uploadedFiles.tela);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	public static obterTela(req: app.Request, res: app.Response) {
		MonitorSala.obterTela(res, parseInt(req.query["id"] as string), parseInt(req.query["idusuario"] as string), req.query["token"] as string, parseInt(req.query["idestudante"] as string));
	}

	@app.http.delete()
	public static excluir(req: app.Request, res: app.Response) {
		if (!validarRequisicaoLocalProducao(req, res))
			return;

		const id = parseInt(req.query["id"] as string);

		if (isNaN(id)) {
			res.status(400).json("Id inválido");
			return;
		}

		const erro = MonitorSala.excluir(id);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}
}

export = MonitorSalaApiRoute;
