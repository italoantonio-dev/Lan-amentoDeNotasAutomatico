const r = await resolverClassificacao(inteiro(event.empresaId), inteiro(event.tipoId), event.cnpj);
return Object.assign({ ok: true }, r);
