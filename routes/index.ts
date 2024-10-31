import app = require("teem");
import appsettings = require("../appsettings");
import Sala = require("../models/sala");
import Usuario = require("../models/usuario");

class IndexRoute {
	public static async index(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/login");
		else
			res.render("index/index", {
				layout: "layout-sem-form",
				titulo: "Salas",
				usuario: u,
			});
	}

	@app.http.all()
	public static async login(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u) {
			const token = req.query["token"] as string;

			if (token) {
				const [mensagem, u] = await Usuario.efetuarLogin(token, res);
				if (mensagem)
					res.render("index/login", { layout: "layout-externo", mensagem: mensagem, ssoRedir: appsettings.ssoRedir });
				else
					res.redirect(app.root + "/");
			} else {
				res.render("index/login", { layout: "layout-externo", mensagem: null, ssoRedir: appsettings.ssoRedir });
			}
		} else {
			res.redirect(app.root + "/");
		}
	}

	public static async acesso(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/login");
		else
			res.render("index/acesso", {
				layout: "layout-sem-form",
				titulo: "Sem Permissão",
				usuario: u
			});
	}

	public static async perfil(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u || (!u.admin && !u.professor))
			res.redirect(app.root + "/");
		else
			res.render("index/perfil", {
				titulo: "Meu Perfil",
				usuario: u
			});
	}

	public static async logout(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (u)
			await Usuario.efetuarLogout(u, res);
		res.redirect(app.root + "/");
	}

	@app.route.methodName("sala/:nome")
	public static async sala(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u || (!u.admin && !u.professor)) {
			res.redirect(app.root + "/acesso");
		} else {
			const nome = req.params["nome"];
			const item = await Sala.iniciarAcessoProfessor(nome, u.id);
			if ((typeof item) === "string")
				res.render("index/erro", {
					layout: "layout-externo",
					mensagem: item,
					erro: item
				});
			else
				res.render("index/sala", {
					layout: "layout-sem-form",
					titulo: "Gerenciar Sala",
					usuario: u,
					item: item,
				});
		}
	}
}

export = IndexRoute;
