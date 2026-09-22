# Nossa Lua de Mel

Experiência privada de Pedro e Mariana: Buenos Aires → Ushuaia → El Calafate, setembro de 2026.

## Usar

1. Uma pessoa abre o site, toca em Começar e escolhe seu nome.
2. Copia o convite privado e envia ao outro. O outro abre esse convite no próprio celular; não deve criar outra viagem pela capa.
3. Cada um escreve ou escolhe sua foto. A primeira resposta espera a segunda.
4. Revelar nossas respostas inicia a contagem nos dois aparelhos.
5. O avanço acontece para os dois. Fechar e abrir no mesmo navegador retoma a sessão.

Os links pessoais funcionam como chaves de acesso. Não compartilhe fora do casal. Uma outra sessão não consegue ler as respostas nem as fotografias. Quem inicia recebe o convite do parceiro: o modelo é para duas pessoas de confiança, sem verificação formal de identidade.

A hospedagem do Sites começa restrita ao proprietário e exige login da plataforma. A entrada sem login depende da autorização para torná-la acessível; os dados continuam exigindo os links secretos no servidor.

## Implementado

- Motor orientado a dados: texto secreto, escolha secreta, foto, Hall da Fama, carta surpresa, resposta conjunta e mensagem final.
- Caminho reduzido de quatro rodadas para testes e experiência completa de 19 rodadas.
- Duas cartas sorteadas por sessão, iguais nos dois celulares.
- D1 para respostas, progresso e escolhas; R2 para fotografias.
- Sincronização serializada: o próximo GET começa 1,5 segundo depois do término do anterior, enquanto a página está visível. Ações do usuário têm precedência sobre snapshots antigos.
- Revelação controlada no servidor: a resposta do parceiro não entra na API antes da hora.
- Contagem 3–2–1, edição antes da revelação, cronômetro opcional de 90 segundos sem bloqueio.
- Fotos reduzidas no aparelho para até 2.000 pixels e convertidas a JPEG sem metadados EXIF. Limite de upload: 5 MB.
- Hall: unanimidade textual automática; diferenças podem ficar separadas ou virar escolha conjunta.
- Cápsula com fotos, respostas, escolhas e filtros por cidade / Hall da Fama.
- Rascunhos locais; respostas finais sempre no servidor.

## Guardar a cápsula (backup)

Durante a experiência, a Nossa Cápsula oferece **Baixar backup até aqui**, somente com memórias reveladas e as próprias respostas de quem exporta (`scope: partial`). Ao final aparece **Baixar nossa cápsula** (tela final e dentro da Nossa Cápsula). O navegador monta `nossa-capsula-AAAA-MM-DD.zip`:

```
nossa-capsula/
  README.txt     como abrir
  memorias.txt   todas as respostas, revelações, Hall da Fama, escolhas e mensagens finais em texto
  capsule.json   dados estruturados (exportVersion 1): sala, playlist usada, 19 rodadas, respostas, decisões, horários de revelação, inventário das fotos
  photos/        os arquivos JPEG originais guardados no R2
```

- `GET /api/export` exige o token pessoal (`Authorization: Bearer`). A sala vem só do token; não há parâmetro de sala.
- O export usa a mesma regra de visibilidade da sessão (`visibleAnswers` em `lib/server.ts`): antes da revelação, a resposta do parceiro não sai. Concluída a experiência, o export é completo (`scope: "complete"`).
- As fotos são baixadas uma a uma por `/api/photo?id=` (autenticado) e empacotadas no aparelho.
- Sem a interface: `node --experimental-strip-types scripts/export-capsule.mjs "<link pessoal>" pasta-destino` grava a pasta e o ZIP (requer o site acessível sem login da plataforma).
- `node --experimental-strip-types tests/export.mjs`: segredo antes da revelação, isolamento entre salas, fotos byte a byte e ZIP íntegro.

## Recuperar o link e lidar com falhas de rede

Dentro de **Guardar meu link para voltar depois**, use **Pedro/Mariana perdeu o link?**. Após confirmação, aparece o novo link completo do parceiro com botão de copiar. O link anterior dessa pessoa é invalidado. O token de quem recupera, sala, playlist, posição, respostas, revelações, decisões e fotos permanecem intactos. A sala e o parceiro são derivados exclusivamente do token autenticado.

Um 401 mantém o token no aparelho e orienta pedir um novo link ao parceiro. Falhas de rede mostram mensagem e tentativa manual, além de recuperação automática sem F5. Voltar à aba ou recuperar a conexão dispara uma sincronização. Um POST com timeout não é repetido automaticamente: pode já ter sido confirmado no servidor; o polling reconcilia o estado.

Limites de espera: sessão/export 20 s; carregar/baixar foto 30 s; upload 60 s; backup no navegador 180 s no total. Os limites cobrem também o corpo das respostas HTTP. Uma foto ausente no D1/R2 interrompe o backup com erro, em vez de produzir silenciosamente uma cápsula incompleta.

Fotos enviadas e trocadas antes de salvar podem ficar sem referência em respostas. **Não há limpeza automática**: uma foto ainda pode pertencer a um rascunho em outro aparelho. Neste MVP, preservar os dados existentes tem prioridade. Nenhuma alteração de schema ou migração é necessária para esta auditoria.

## Conteúdo

Edite `lib/rounds.ts`. A ordem está em `makePlaylist()` e é gravada por sessão. `sliceIds` mantém o caminho mínimo. Preserve IDs usados em sessões existentes. Alterações de texto também afetam essas sessões.

As perguntas vieram majoritariamente dos exemplos do briefing. Duração flexível: cerca de uma hora com conversa, sem tempo obrigatório.

## Desenvolvimento

Node 22.13+. Instale com `npm ci`. Se o launcher npm do Windows falhar, use `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ci --prefer-offline --no-audit --no-fund`.

- `node scripts/run-framework.mjs dev`: servidor local.
- `node node_modules/typescript/bin/tsc --noEmit`: TypeScript.
- `node scripts/run-framework.mjs build`: build Worker + cliente.
- `node tests/integration.mjs`: caminho mínimo, isolamento, fotos e revelação.
- `node tests/full-journey.mjs`: jornada completa e export completo.
- `node --experimental-strip-types --test tests/network.mjs`: API lenta, serialização, recuperação, precedência de POST e timeout.
- `node tests/relink.mjs`: recuperação após rodadas, foto, Hall e resposta ainda secreta.

Os testes usam `http://localhost:5173`; `TEST_ORIGIN` permite outro servidor local. Os testes recusam endereços que não sejam loopback para impedir escrita acidental em produção. Cada execução cria sessões de teste independentes.

Gere migrações com `node node_modules/drizzle-kit/bin.cjs generate`. Após o primeiro build, aplique cada migração local uma única vez:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clumsy_colossus.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_late_justice.sql
```

O Sites provisiona os recursos remotos e aplica migrações no deploy. Não versione `.wrangler`, links pessoais ou credenciais. Não modifique migrações publicadas.

## Limites de hoje

- Não há data de conclusão gravada no banco; o export traz `lastRevealedAt`.
- Sem PDF, impressão, fotolivro, analytics ou placar.
- Fotos HEIC dependem do navegador; quando não decodifica, use JPEG ou captura de tela.
- É necessário estar conectado para enviar e avançar; rascunhos de texto permanecem no aparelho durante falhas.
- Abrir o link da outra pessoa no mesmo navegador muda a identidade persistida. Use aparelhos ou perfis distintos para uso simultâneo.
- Sem recuperação por e-mail: guarde os links antes de limpar dados do navegador.

## Fotografia da capa

Perito Moreno Glacier, Fernando, 2023. Wikimedia Commons, CC BY-SA 4.0. Recorte responsivo na interface.

Fonte: https://commons.wikimedia.org/wiki/File:Perito_Moreno_Glacier_2023.jpg
Licença: https://creativecommons.org/licenses/by-sa/4.0/
