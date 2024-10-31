import app = require("teem");
import { randomBytes } from "crypto";
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");
import Estudante = require("./estudante");
import Perfil = require("../enums/perfil");
import Sala = require("./sala");

class MonitorSala {
	private static readonly SalasPorId = new Map<number, Sala>();

	public static iniciarAcessoProfessor(sala: Sala): string | null {
		if (!sala)
			return "Sala inválida";

		if (!(sala.id = parseInt(sala.id as any)))
			return "Id de sala inválido";

		if (!(sala.idusuario = parseInt(sala.idusuario as any)))
			return "Id de usuário inválido";

		if (!sala.token)
			return "Token inválido";

		const salaExistente = MonitorSala.SalasPorId.get(sala.id);
		if (!salaExistente) {
			sala.telasPorEstudante = new Map();
			sala.estudantesPorId = {};
			MonitorSala.SalasPorId.set(sala.id, sala);
		} else {
			if (sala.idusuario !== salaExistente.idusuario)
				return "A sala pertence a outro usuário";

			salaExistente.token = sala.token;
		}

		return null;
	}

	public static iniciarAcessoEstudante(sala: Sala): string | null {
		if (!sala)
			return "Sala inválida";

		if (!(sala.id = parseInt(sala.id as any)))
			return "Id de sala inválido";

		// No caso do acesso dos estudantes, os dados abaixo se referem ao estudante em si

		if (!(sala.idusuario = parseInt(sala.idusuario as any)))
			return "Id de usuário inválido";

		if (!sala.nome)
			return "Nome inválido";

		if (!sala.token)
			return "Token inválido";

		const salaExistente = MonitorSala.SalasPorId.get(sala.id);
		if (!salaExistente)
			return "Sala não encontrada";

		salaExistente.telasPorEstudante.set(sala.idusuario, null);
		salaExistente.estudantesPorId[sala.idusuario] = {
			id: sala.idusuario,
			idsala: sala.id,
			nome: sala.nome,
			token: sala.token,
			ultimo_ping: 0,
		};

		return null;
	}

	private static obterSalaExistente(id: number, idusuario: number, token: string): Sala | null {
		if (!id || !idusuario || !token)
			return null;

		const salaExistente = MonitorSala.SalasPorId.get(id);
		if (!salaExistente || salaExistente.idusuario !== idusuario || salaExistente.token !== token)
			return null;

		return salaExistente;
	}

	public static listarEstudantes(sala: Sala | null): { [id: number]: Estudante } | null {
		const salaExistente = (sala ? MonitorSala.obterSalaExistente(parseInt(sala.id as any), parseInt(sala.idusuario as any), sala.token) : null);
		return (salaExistente ? salaExistente.estudantesPorId : null);
	}

	public static excluirEstudante(sala: Sala | null): string | null {
		const salaExistente = (sala ? MonitorSala.obterSalaExistente(parseInt(sala.id as any), parseInt(sala.idusuario as any), sala.token) : null);
		if (!salaExistente)
			return "Sala não encontrada";

		const idestudante = parseInt((sala as any).idestudante);
		if (idestudante) {
			salaExistente.telasPorEstudante.delete(idestudante);
			delete salaExistente.estudantesPorId[idestudante];
		}

		return null;
	}

	public static enviarTela(estudante: Estudante, tela?: app.UploadedFile | null): string | null {
		if (!estudante)
			return "Estudante inválido";

		if (!(estudante.id = parseInt(estudante.id as any)))
			return "Id de estudante inválido";

		if (!(estudante.idsala = parseInt(estudante.idsala as any)))
			return "Id de sala inválido";

		if (!estudante.token)
			return "Token inválido";

		if (!tela || !tela.buffer || !tela.buffer.length || tela.buffer.length > (1024 * 1024))
			return "Tela inválida";

		const salaExistente = MonitorSala.SalasPorId.get(estudante.idsala);
		if (!salaExistente)
			return "Sala não encontrada";

		const estudanteExistente = salaExistente.estudantesPorId[estudante.id];
		if (!estudanteExistente || estudanteExistente.token !== estudante.token)
			return "Estudante não encontrado";

		estudanteExistente.ultimo_ping = Date.now();
		salaExistente.telasPorEstudante.set(estudante.id, tela.buffer);

		return null;
	}

	public static obterTela(res: app.Response, id: number, idusuario: number, token: string, idestudante: number): void {
		const salaExistente = MonitorSala.obterSalaExistente(id, idusuario, token);
		if (!salaExistente) {
			res.status(404).json("Sala não encontrada");
			return;
		}

		const buffer = salaExistente.telasPorEstudante.get(idestudante);
		if (!buffer) {
			res.status(404).json("Tela não encontrada");
			return;
		}

		salaExistente.telasPorEstudante.set(idestudante, null);

		res.contentType("image/jpeg").end(buffer);
	}

	public static excluir(id: number): string | null {
		if (!id)
			return "Id de sala inválido";

		const sala = MonitorSala.SalasPorId.get(id);
		if (sala) {
			MonitorSala.SalasPorId.delete(id);
			sala.telasPorEstudante.clear();
			sala.estudantesPorId = {};
		}

		return null;
	}
}

export = MonitorSala;
