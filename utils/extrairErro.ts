
export = function extrairErro(erro: any): string {
	return (erro ? (((typeof erro) === "string") ? erro : JSON.stringify(erro)) : "[Erro desconhecido]");
}
