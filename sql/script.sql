CREATE DATABASE IF NOT EXISTS monitor DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE monitor;

-- DROP TABLE IF EXISTS perfil;
CREATE TABLE perfil (
  id int NOT NULL,
  nome varchar(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY nome_UN (nome)
);

-- Manter sincronizado com enums/perfil.ts e models/perfil.ts
INSERT INTO perfil (id, nome) VALUES (1, 'Administrador'), (2, 'Professor'), (3, 'Estudante');

-- DROP TABLE IF EXISTS usuario;
CREATE TABLE usuario (
  id int NOT NULL AUTO_INCREMENT,
  email varchar(100) NOT NULL,
  nome varchar(100) NOT NULL,
  idperfil int NOT NULL,
  token char(32) DEFAULT NULL,
  exclusao datetime NULL,
  criacao datetime NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY usuario_email_UN (email),
  KEY usuario_exclusao_IX (exclusao),
  KEY usuario_idperfil_FK_IX (idperfil),
  KEY usuario_nome_IX (nome),
  CONSTRAINT usuario_idperfil_FK FOREIGN KEY (idperfil) REFERENCES perfil (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

INSERT INTO usuario (email, nome, idperfil, token, criacao) VALUES ('admin@espm.br', 'Administrador', 1, NULL, NOW());

-- DROP TABLE IF EXISTS sala;
CREATE TABLE sala (
  id bigint NOT NULL AUTO_INCREMENT,
  idusuario int NOT NULL,
  idhost tinyint NOT NULL,
  nome varchar(50) NOT NULL,
  exclusao datetime NULL,
  criacao datetime NOT NULL,
  ultimo_ping datetime NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sala_nome_UN (nome),
  KEY sala_idusuario_exclusao_IX (idusuario, exclusao),
  KEY sala_exclusao_idhost_IX (exclusao, idhost),
  CONSTRAINT sala_idusuario_FK FOREIGN KEY (idusuario) REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
