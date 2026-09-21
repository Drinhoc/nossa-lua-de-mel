export type Person='Pedro'|'Mariana';
export type Round={id:string;type:'secret'|'choice'|'photo'|'hall'|'surprise'|'joint'|'final';city:string;label:string;title:string;note:string;options?:string[];photo?:boolean};
export const rounds:Round[]=[
{id:'primeira-imagem',type:'secret',city:'Toda a viagem',label:'FLASHBACK',title:'Qual é a primeira imagem que aparece na sua cabeça quando pensa na nossa lua de mel?',note:'Feche os olhos por um instante. Escreva antes de contar.'},
{id:'chegada-argentina',type:'secret',city:'Buenos Aires',label:'A PRIMEIRA PARADA',title:'Qual foi sua primeira impressão quando chegamos à Argentina?',note:'O som da rua, o ar, a primeira caminhada. Voltem àquele instante.'},
{id:'foto-buenos-aires',type:'photo',city:'Buenos Aires',label:'CAÇA À GALERIA',title:'Uma foto que seja Buenos Aires para você.',note:'Não precisa ser a mais bonita. Precisa levar você de volta.'},
{id:'a-refeicao',type:'hall',city:'Toda a viagem',label:'HALL DA FAMA · A REFEIÇÃO',title:'PQP, que negócio bom.',note:'Qual foi a melhor comida da viagem? Cada um escolhe em segredo.'},
{id:'detalhe-perdido',type:'surprise',city:'Toda a viagem',label:'CARTA SURPRESA',title:'Detalhe perdido',note:'Conte uma coisinha minúscula da viagem que você tem medo de esquecer.'},
{id:'ushuaia-tres-palavras',type:'surprise',city:'Ushuaia',label:'CARTA SURPRESA',title:'Bate-pronto',note:'Descreva Ushuaia em três palavras. As primeiras que vierem.'},
{id:'nunca-contei',type:'surprise',city:'Toda a viagem',label:'CARTA SURPRESA',title:'Eu nunca te contei',note:'Conte algo que você sentiu durante a viagem mas talvez não tenha falado naquela hora.'},
{id:'estavamos-la',type:'secret',city:'Ushuaia',label:'VOCÊ ESTAVA LÁ COMIGO',title:'Em qual momento você acha que eu estava mais feliz?',note:'Responda pensando no seu amor. Depois, contem como foi por dentro.'},
{id:'foto-feliz',type:'photo',city:'Toda a viagem',label:'CAÇA À GALERIA',title:'Encontre uma foto em que seu amor parece genuinamente feliz.',note:'O sorriso distraído. O olhar para longe. Você sabe qual é.'},
{id:'o-caos',type:'hall',city:'Toda a viagem',label:'HALL DA FAMA · O CAOS',title:'Na hora foi um perrengue. Agora é uma história.',note:'Qual foi nosso caos favorito da viagem?'},
{id:'momento-lua-de-mel',type:'secret',city:'Toda a viagem',label:'FLASHBACK',title:'Quando você pensou: “estamos realmente na nossa lua de mel”?',note:'Pode ter sido um grande cenário. Ou um segundo só nosso.'},
{id:'o-cenario',type:'hall',city:'El Calafate',label:'HALL DA FAMA · O CENÁRIO',title:'Daquelas coisas que deixam a gente em silêncio.',note:'Qual foi a coisa mais bonita que vimos em El Calafate?'},
{id:'foto-nao-postada',type:'photo',city:'El Calafate',label:'CAÇA À GALERIA',title:'Uma foto linda que provavelmente nunca seria postada.',note:'Ela não precisa de público. Já encontrou seu lugar aqui.'},
{id:'repetiria',type:'secret',city:'Toda a viagem',label:'VOCÊ ESTAVA LÁ COMIGO',title:'Qual experiência você acha que eu repetiria amanhã sem pensar?',note:'Escolha com os olhos do outro. Descubram se lembraram da mesma coisa.'},
{id:'voltar-cidade',type:'choice',city:'Toda a viagem',label:'VALE-REPETECO',title:'Se a viagem recomeçasse amanhã, onde você queria acordar?',note:'Escolha uma cidade em segredo. Depois, conte o motivo.',options:['Buenos Aires','Ushuaia','El Calafate']},
{id:'o-lugar',type:'hall',city:'Toda a viagem',label:'HALL DA FAMA · O LUGAR',title:'Um lugar que ficou em nós.',note:'Qual lugar da viagem você chamaria de favorito?'},
{id:'a-foto',type:'hall',city:'Toda a viagem',label:'HALL DA FAMA · NÓS DOIS',title:'A nossa fotografia.',note:'Escolha sua foto favorita de nós dois na lua de mel.',photo:true},
{id:'titulo-viagem',type:'joint',city:'Toda a viagem',label:'A QUATRO MÃOS',title:'Se esta viagem fosse um capítulo da nossa vida, qual seria o título?',note:'Conversem e escrevam uma única resposta juntos. Um de vocês registra.'},
{id:'cinquenta-anos',type:'final',city:'Toda a viagem',label:'PARA LEVAR COM A GENTE',title:'Se daqui a 50 anos pudéssemos recuperar apenas uma memória completa dessa lua de mel, qual você escolheria?',note:'Sem procurar a resposta perfeita. Só aquela que você gostaria de viver outra vez.'},
{id:'nos-do-futuro',type:'final',city:'Toda a viagem',label:'UMA CARTA PARA DEPOIS',title:'Escreva uma mensagem curta para nós dois do futuro.',note:'Sobre quem éramos aqui. Sobre o que você deseja que a gente nunca esqueça.'}
];
export const sliceIds=['primeira-imagem','foto-buenos-aires','a-refeicao','detalhe-perdido'];
export function makePlaylist(){const surprises=['detalhe-perdido','ushuaia-tres-palavras','nunca-contei'];const n=crypto.getRandomValues(new Uint32Array(1))[0]%surprises.length;return ['primeira-imagem','chegada-argentina','foto-buenos-aires','a-refeicao',surprises[n],'estavamos-la','foto-feliz','o-caos','momento-lua-de-mel','o-cenario','foto-nao-postada',surprises[(n+1)%surprises.length],'repetiria','voltar-cidade','o-lugar','a-foto','titulo-viagem','cinquenta-anos','nos-do-futuro'];}
export function roundById(id:string){const r=rounds.find(r=>r.id===id);if(!r)throw new Error('Rodada desconhecida');return r;}
export const other=(p:Person):Person=>p==='Pedro'?'Mariana':'Pedro';
