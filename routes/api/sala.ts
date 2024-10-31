import app = require("teem");
import Perfil = require("../../enums/perfil");
import Sala = require("../../models/sala");
import Usuario = require("../../models/usuario");

class SalaApiRoute {
	public static async listar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		res.json(await Sala.listar());
	}

	@app.http.post()
	public static async criar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, false, true);
		if (!u)
			return;

		const sala: Sala = req.body;

		if (sala)
			sala.idusuario = u.id;

		const erro = await Sala.criar(req.body);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.delete()
	public static async excluir(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, false, true);
		if (!u)
			return;

		const id = parseInt(req.query["id"] as string);

		if (isNaN(id)) {
			res.status(400).json("Id inválido");
			return;
		}

		const erro = await Sala.excluir(id, u.id, u.idperfil);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static async iniciarAcessoEstudante(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const id = parseInt(req.body && req.body.id);

		if (!id) {
			res.status(400).json("Id inválido");
			return;
		}

		const ret = await Sala.iniciarAcessoEstudante(id, u.id, u.nome);

		if (typeof ret === "string")
			res.status(400);

		res.json(ret);
	}
}

export = SalaApiRoute;
