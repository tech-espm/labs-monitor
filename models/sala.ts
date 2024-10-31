import app = require("teem");
import { randomBytes } from "crypto";
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");
import Estudante = require("./estudante");
import Perfil = require("../enums/perfil");
import extrairErro = require("../utils/extrairErro");

interface Sala {
	id: number;
	idusuario: number;
  	idhost: number;
	nome: string;
	criacao: string;
	ultimo_ping: string;

	// Utilizados apenas através da API
	token: string;
	apiPrefixoExterno: string;
	now: number;
	telasPorEstudante: Map<number, Buffer | null>;
	estudantesPorId: { [id: number]: Estudante };
}

class Sala {
	private static readonly RegExpNome = /[^0-9A-Z\-]/g;

	private static validar(sala: Sala, criacao: boolean): string | null {
		if (!sala)
			return "Sala inválida";

		sala.id = parseInt(sala.id as any);

		if (!criacao) {
			if (isNaN(sala.id))
				return "Id inválido";
		}

		if (!(sala.idusuario = parseInt(sala.idusuario as any)))
			return "Usuário inválido";

		if (!sala.nome || !(sala.nome = sala.nome.normalize().trim().toUpperCase()) || sala.nome.length > 35)
			return "Nome inválido";

		if (sala.nome.match(Sala.RegExpNome))
			return "O nome da sala só pode conter dígitos, letras ou traços";

		return null;
	}

	public static listar(): Promise<Sala[]> {
		return app.sql.connect(async (sql) => {
			return (await sql.query("select s.id, s.nome, s.idusuario, s.idhost, u.nome usuario, date_format(s.criacao, '%d/%m/%Y %H:%i') criacao, date_format(s.ultimo_ping, '%d/%m/%Y %H:%i') ultimo_ping from sala s inner join usuario u on u.id = s.idusuario where s.exclusao is null")) || [];
		});
	}

	public static async criar(sala: Sala): Promise<string | null> {
		const erro = Sala.validar(sala, true);
		if (erro)
			return erro;

		return app.sql.connect(async (sql) => {
			try {
				await sql.beginTransaction();

				const agora = DataUtil.horarioDeBrasiliaISOComHorario();

				const nomeExistente = await sql.scalar("select nome from sala where exclusao is null and idusuario = ?", [sala.idusuario]) as string | null;
				if (nomeExistente)
					return `Não é possível criar uma nova sala sem excluir a sala "${nomeExistente}" antes`;

				const totaisPorHost = new Map<number, number>();
				for (let i = appsettings.api.prefixoInterno.length - 1; i >= 0; i--)
					totaisPorHost.set(i, 0);

				const totaisAtivos: any[] = await sql.query("select idhost, count(*) total from sala where exclusao is null group by idhost");
				if (totaisAtivos && totaisAtivos.length) {
					for (let i = totaisAtivos.length - 1; i >= 0; i--)
						totaisPorHost.set(totaisAtivos[i].idhost, totaisAtivos[i].total);
				}

				const totais = [...totaisPorHost.entries()];
				totais.sort((a, b) => (a[1] - b[1]));

				sala.idhost = totais[0][0];

				await sql.query("insert into sala (idusuario, idhost, nome, criacao, ultimo_ping) values (?, ?, ?, ?, ?)", [sala.idusuario, sala.idhost, sala.nome, agora, agora]);

				sala.id = await sql.scalar("select last_insert_id()") as number;

				sala.token = randomBytes(16).toString("hex");

				try {
					const response = await app.request.json.postObject(appsettings.api.prefixoInterno[sala.idhost] + "/api/monitorSala/iniciarAcessoProfessor", sala);

					if (!response.success)
						return "Erro " + response.statusCode + " ao iniciar a sala no servidor da API: " + extrairErro(response.result);
				} catch (ex: any) {
					return "Exceção ao iniciar a sala no servidor da API: " + (ex.message || ex.toString());
				}

				await sql.commit();

				return null;
			} catch (ex: any) {
				switch (ex.code) {
					case "ER_NO_REFERENCED_ROW":
					case "ER_NO_REFERENCED_ROW_2":
						return "Usuário não encontrado";
				}

				throw ex;
			}
		});
	}

	public static iniciarAcessoProfessor(nome: string, idusuario: number): Promise<Sala | string> {
		return app.sql.connect(async (sql) => {
			const lista: Sala[] = await sql.query("select id, nome, idusuario, idhost, date_format(criacao, '%d/%m/%Y %H:%i') criacao, date_format(ultimo_ping, '%d/%m/%Y %H:%i') ultimo_ping from sala where idusuario = ? and exclusao is null and nome = ?", [idusuario, nome]);

			if (!lista || !lista[0])
				return "Sala não encontrada";

			const sala = lista[0];

			sala.token = randomBytes(16).toString("hex");
			sala.apiPrefixoExterno = appsettings.api.prefixoExterno[sala.idhost];

			try {
				const response = await app.request.json.postObject(appsettings.api.prefixoInterno[sala.idhost] + "/api/monitorSala/iniciarAcessoProfessor", sala);

				if (!response.success)
					return "Erro " + response.statusCode + " ao iniciar a sala no servidor da API: " + extrairErro(response.result);
			} catch (ex: any) {
				return "Exceção ao iniciar a sala no servidor da API: " + (ex.message || ex.toString());
			}

			sala.now = Date.now();

			return sala;
		});
	}

	public static iniciarAcessoEstudante(id: number, idestudante: number, nomeestudante: string): Promise<Sala | string> {
		return app.sql.connect(async (sql) => {
			const lista: Sala[] = await sql.query("select id, nome, idhost, date_format(criacao, '%d/%m/%Y %H:%i') criacao, date_format(ultimo_ping, '%d/%m/%Y %H:%i') ultimo_ping from sala where id = ? and exclusao is null", [id]);

			if (!lista || !lista[0])
				return "Sala não encontrada";

			const sala = lista[0];

			const salaNome = sala.nome;

			sala.idusuario = idestudante;
			sala.nome = nomeestudante.toUpperCase();
			sala.token = randomBytes(16).toString("hex");
			sala.apiPrefixoExterno = appsettings.api.prefixoExterno[sala.idhost];

			try {
				const response = await app.request.json.postObject(appsettings.api.prefixoInterno[sala.idhost] + "/api/monitorSala/iniciarAcessoEstudante", sala);

				if (!response.success)
					return "Erro " + response.statusCode + " ao entrar na sala no servidor da API: " + extrairErro(response.result);
			} catch (ex: any) {
				return "Exceção ao entrar na sala no servidor da API: " + (ex.message || ex.toString());
			}

			sala.nome = salaNome;

			return sala;
		});
	}

	public static async excluir(id: number, idusuario: number, idperfil: Perfil): Promise<string | null> {
		return app.sql.connect(async (sql) => {
			await sql.beginTransaction();

			const idhost: number | null = await sql.scalar("select idhost from sala where id = ?", [id]);

			if (idhost === null)
				return "Sala não encontrada";

			// Utilizar substr(nome, instr(nome, ':') + 1) para remover o prefixo, caso precise desfazer a exclusão (caso
			// não exista o prefixo, instr() vai retornar 0, que, com o + 1, faz o substr() retornar a própria string inteira)
			await sql.query("update sala set nome = concat('@', id, ':', nome), exclusao = ? where id = ? and exclusao is null" + ((idperfil === Perfil.Administrador) ? "" : " and idusuario = ?"), (idperfil === Perfil.Administrador) ? [DataUtil.horarioDeBrasiliaISOComHorario(), id] : [DataUtil.horarioDeBrasiliaISOComHorario(), id, idusuario]);

			if (!sql.affectedRows)
				return "Sala não encontrada";

			try {
				const response = await app.request.json.delete(appsettings.api.prefixoInterno[idhost] + "/api/monitorSala/excluir?id=" + id);

				if (!response.success)
					return "Erro " + response.statusCode + " ao excluir a sala no servidor da API: " + extrairErro(response.result);
			} catch (ex: any) {
				return "Exceção ao excluir a sala no servidor da API: " + (ex.message || ex.toString());
			}

			await sql.commit();

			return null;
		});
	}
}

export = Sala;
