import app = require("teem");
import { randomBytes } from "crypto";
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");
import GeradorHash = require("../utils/geradorHash");
import intToHex = require("../utils/intToHex");
import Perfil = require("../enums/perfil");
import Validacao = require("../utils/validacao");

interface Usuario {
	id: number;
	email: string;
	nome: string;
	idperfil: Perfil;
	criacao: string;

	// Utilizados apenas através do cookie
	admin: boolean;
	professor: boolean;
}

class Usuario {
	private static readonly IdAdmin = 1;

	public static async cookie(req: app.Request, res: app.Response | null = null, admin: boolean = false, adminOuProfessor: boolean = false): Promise<Usuario | null> {
		let cookieStr = req.cookies[appsettings.cookie] as string;
		if (!cookieStr || cookieStr.length !== 48) {
			if (res) {
				res.statusCode = 403;
				res.json("Não permitido");
			}
			return null;
		} else {
			return await app.sql.connect(async (sql) => {
				let id = parseInt(cookieStr.substring(0, 8), 16) ^ appsettings.usuarioHashId;
				let usuario: Usuario | null = null;

				let rows = await sql.query("select id, email, nome, idperfil, token from usuario where id = ?", [id]);
				let row: any;

				if (!rows || !rows.length || !(row = rows[0]))
					return null;

				let token = cookieStr.substring(16);

				if (!row.token || token !== (row.token as string))
					return null;

				usuario = new Usuario();
				usuario.id = id;
				usuario.email = row.email as string;
				usuario.nome = row.nome as string;
				usuario.idperfil = row.idperfil as number;
				usuario.admin = (usuario.idperfil === Perfil.Administrador);
				usuario.professor = (usuario.idperfil === Perfil.Professor);

				if (
					(adminOuProfessor && usuario && usuario.idperfil !== Perfil.Administrador && usuario.idperfil !== Perfil.Professor) ||
					(admin && usuario && usuario.idperfil !== Perfil.Administrador)
				)
					usuario = null;

				if (!usuario && res) {
					res.statusCode = 403;
					res.json("Não permitido");
				}

				return usuario;
			});
		}
	}

	private static gerarTokenCookie(id: number): [string, string] {
		let idStr = intToHex(id ^ appsettings.usuarioHashId);
		let idExtra = intToHex(0);
		let token = randomBytes(16).toString("hex");
		let cookieStr = idStr + idExtra + token;
		return [token, cookieStr];
	}

	public static async efetuarLogin(token: string, res: app.Response): Promise<[string | null, Usuario | null]> {
		const resposta = await app.request.json.get(appsettings.ssoToken + encodeURIComponent(token));
		if (!resposta.success || !resposta.result)
			return [(resposta.result && resposta.result.toString()) || ("Erro de comunicação de rede: " + resposta.statusCode), null];

		const json = resposta.result;
		if (json.erro)
			return [json.erro, null];

		return await app.sql.connect(async (sql) => {
			const usuarios: Usuario[] = await sql.query("select id, email, nome, idperfil from usuario where email = ? and exclusao is null", [json.dados.email]);
			let usuario: Usuario;

			if (!usuarios || !usuarios.length || !(usuario = usuarios[0])) {
				// Quando o usuário não é encontrado, cria um novo, mas como estudante
				usuario = {
					id: 0,
					email: json.dados.email,
					nome: json.dados.nome,
					criacao: DataUtil.horarioDeBrasiliaISOComHorario(),
					idperfil: Perfil.Estudante,
					admin: false,
					professor: false,
				};

				let erro = Usuario.validar(usuario, true);

				if (erro)
					//return ["Usuário não está cadastrado. Por favor, entre em contato com o administrador do sistema.", null];
					return [erro, null];

				erro = await Usuario.criarInterno(sql, usuario);
				if (erro)
					return [erro, null];
			}

			let [token, cookieStr] = Usuario.gerarTokenCookie(usuario.id);

			await sql.query("update usuario set token = ? where id = ?", [token, usuario.id]);

			usuario.admin = (usuario.idperfil === Perfil.Administrador);

			res.cookie(appsettings.cookie, cookieStr, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, path: "/", secure: appsettings.cookieSecure });

			return [null, usuario];
		});
	}

	public static async efetuarLogout(usuario: Usuario, res: app.Response): Promise<void> {
		await app.sql.connect(async (sql) => {
			await sql.query("update usuario set token = null where id = ?", [usuario.id]);

			res.cookie(appsettings.cookie, "", { expires: new Date(0), httpOnly: true, path: "/", secure: appsettings.cookieSecure });
		});
	}

	public static async alterarPerfil(usuario: Usuario, res: app.Response, nome: string): Promise<string | null> {
		nome = (nome || "").normalize().trim();
		if (nome.length < 3 || nome.length > 100)
			return "Nome inválido";

		await app.sql.connect(async (sql) => {
			await sql.query("update usuario set nome = ? where id = ?", [nome, usuario.id]);
		});

		return null;
	}

	private static validar(usuario: Usuario, criacao: boolean): string | null {
		if (!usuario)
			return "Usuário inválido";

		usuario.id = parseInt(usuario.id as any);

		if (criacao) {
			// Limita o e-mail a 85 caracteres para deixar 15 sobrando, para tentar evitar perda de dados durante a concatenação da exclusão
			if (!usuario.email || !Validacao.isEmail(usuario.email = usuario.email.normalize().trim().toLowerCase()) || usuario.email.length > 85)
				return "E-mail inválido";

			if (!usuario.email.endsWith("@espm.br") && !usuario.email.endsWith("@acad.espm.br"))
				return "O e-mail do usuário deve terminar com @espm.br ou @acad.espm.br";
		} else {
			if (isNaN(usuario.id))
				return "Id inválido";
		}

		if (!usuario.nome || !(usuario.nome = usuario.nome.normalize().trim()) || usuario.nome.length > 100)
			return "Nome inválido";

		if (isNaN(usuario.idperfil = parseInt(usuario.idperfil as any) as Perfil))
			return "Perfil inválido";

		return null;
	}

	public static listar(): Promise<Usuario[]> {
		return app.sql.connect(async (sql) => {
			return (await sql.query("select u.id, u.email, u.nome, p.nome perfil, date_format(u.criacao, '%d/%m/%Y') criacao from usuario u inner join perfil p on p.id = u.idperfil where u.exclusao is null")) || [];
		});
	}

	public static listarCombo(): Promise<Usuario[]> {
		return app.sql.connect(async (sql) => {
			return (await sql.query("select id, nome from usuario where exclusao is null order by nome asc")) || [];
		});
	}

	public static obter(id: number): Promise<Usuario> {
		return app.sql.connect(async (sql) => {
			const lista: Usuario[] = await sql.query("select id, email, nome, idperfil, date_format(criacao, '%d/%m/%Y') criacao from usuario where id = ?", [id]);

			return ((lista && lista[0]) || null);
		});
	}

	public static async criarInterno(sql: app.Sql, usuario: Usuario): Promise<string | null> {
		try {
			await sql.query("insert into usuario (email, nome, idperfil, criacao) values (?, ?, ?, now())", [usuario.email, usuario.nome, usuario.idperfil]);

			usuario.id = await sql.scalar("select last_insert_id()") as number;

			return null;
		} catch (ex: any) {
			if (ex.code) {
				switch (ex.code) {
					case "ER_DUP_ENTRY":
						return `O e-mail ${usuario.email} já está em uso`;
					case "ER_NO_REFERENCED_ROW":
					case "ER_NO_REFERENCED_ROW_2":
						return "Perfil não encontrado";
					default:
						throw ex;
				}
			} else {
				throw ex;
			}
		}
	}

	public static async criar(usuario: Usuario): Promise<string | null> {
		const erro = Usuario.validar(usuario, true);
		if (erro)
			return erro;

		return app.sql.connect(async (sql) => {
			return await Usuario.criarInterno(sql, usuario);
		});
	}

	public static async editar(usuario: Usuario): Promise<string | null> {
		const erro = Usuario.validar(usuario, false);
		if (erro)
			return erro;

		if (usuario.id === Usuario.IdAdmin)
			return "Não é possível editar o usuário administrador principal";

		return app.sql.connect(async (sql) => {
			await sql.query("update usuario set nome = ?, idperfil = ? where id = ?", [usuario.nome, usuario.idperfil, usuario.id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}

	public static async excluir(id: number): Promise<string | null> {
		if (id === Usuario.IdAdmin)
			return "Não é possível excluir o usuário administrador principal";

		return app.sql.connect(async (sql) => {
			// Utilizar substr(email, instr(email, ':') + 1) para remover o prefixo, caso precise desfazer a exclusão (caso
			// não exista o prefixo, instr() vai retornar 0, que, com o + 1, faz o substr() retornar a própria string inteira)
			await sql.query("update usuario set email = concat('@', id, ':', email), token = null, exclusao = ? where id = ? and exclusao is null", [DataUtil.horarioDeBrasiliaISOComHorario(), id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}
}

export = Usuario;
