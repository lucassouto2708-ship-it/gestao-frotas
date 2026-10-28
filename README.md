# Gestão de Frotas

Aplicativo web (PWA, funciona no celular e pode ser instalado na tela inicial) para controlar a frota:

- **Cadastro de carros**: placa, modelo e km inicial do mostrador (com foto opcional).
- **Viagens**: o motorista tira foto do mostrador na saída e na chegada. O app calcula os km rodados.
- **Manutenção**: aviso de troca de óleo (padrão a cada **10.000 km**) e revisão (padrão a cada **20.000 km**), com alerta ao atingir 90% do intervalo. No cadastro do carro dá para informar a última troca de óleo e a última revisão. Depois, o gestor registra serviços (óleo, revisão, pneus, freios, bateria, outros) com km, data e custo, e cada carro tem seu **histórico de manutenção**. Troca de óleo e revisão zeram o contador. O gestor e o ADM excluem registros. Os intervalos podem ser alterados por carro.
- **Pneus (TWI)**: medição do sulco dos 4 pneus (dianteiro/traseiro, esquerdo/direito) com foto do medidor. Abaixo de 1,6 mm (TWI, mínimo legal) aparece "Trocar"; abaixo de 3 mm, "Atenção".
- **Rastreio por GPS na viagem**: ao iniciar a viagem o app liga o GPS do celular (com a tela mantida acesa) e mostra, em todas as telas, a distância, o tempo e a velocidade. Ao finalizar, compara os km do GPS com os do odômetro (que continua sendo o registro oficial) e avisa se houver diferença acima de 10% e 2 km. Se o app for fechado no meio da viagem, o rastreio continua ao reabrir. O ADM vê a cobertura do rastreio, as velocidades e a rota de cada viagem. O navegador só rastreia com o app aberto e a tela ligada: se a tela bloquear, ficam trechos sem sinal (registrados como interrupções).
- **Fotos leves**: antes do envio, as fotos são reduzidas para 1200 px (~100 KB cada), o que economiza espaço no Supabase e mantém a leitura dos números.
- **Leitura das fotos com marcação**: depois de tirar a foto, o usuário marca com um retângulo onde estão os números (no medidor de pneu o app já sugere a área sozinho). O app lê só aquele trecho: primeiro com um leitor próprio de visores de 7 segmentos (medidor de sulco e odômetros digitais, de fundo claro ou escuro) e, se não conseguir, com o [Tesseract.js](https://github.com/naptha/tesseract.js). Tudo roda no próprio celular, de graça e sem chave de API. O valor é sempre conferido pelo usuário antes de salvar. O sulco do pneu é guardado com 2 casas decimais (ex.: 1,27 mm).

## Clientes (organizações) e tipos de usuário

O sistema é **multiempresa**: cada cliente (empresa ou município) é uma **organização**, com os próprios veículos, usuários, parâmetros e histórico, totalmente separados dos demais (a placa só precisa ser única dentro da organização). Quem vende o sistema é o **ADM**; dentro de cada cliente há **gestores** e **motoristas**.

| | Motorista | Gestor (da organização) | ADM (dono do sistema) |
|---|---|---|---|
| Iniciar e finalizar viagem com fotos e GPS | ✅ só nos carros vinculados a ele | ✅ | ✅ |
| Ver avisos de óleo/revisão dos carros dele | ✅ (só leitura) | ✅ | ✅ |
| Cadastrar carro | ❌ | ✅ | ✅ |
| Registrar manutenção (óleo, revisão…) e ver histórico | ❌ | ✅ | ✅ |
| Medir pneus | ❌ | ✅ | ✅ |
| Painel da frota, viagens, fotos e rota de todos | ❌ | ✅ da organização | ✅ de todas |
| Parâmetros de manutenção (padrão e por carro) | ❌ | ✅ da organização | ✅ de todas |
| Vincular motoristas a carros | ❌ | ✅ | ✅ |
| Convidar pessoas, promover a gestor, desativar acesso | ❌ | ✅ da organização | ✅ |
| Cadastrar/suspender organizações | ❌ | ❌ | ✅ |

As permissões são garantidas no próprio banco (Row Level Security do Supabase), não só na tela. Organização suspensa ou usuário desativado perde o acesso na hora.

**Como entra cada pessoa:** o gestor (ou o ADM) gera um **convite** em *Usuários* e envia o link (`/convite?c=CÓDIGO`). A pessoa cria a conta, o convite a coloca na organização com o papel escolhido. Convites vencem em 7 dias (ajustável), valem uma vez e podem ser revogados.

## Tecnologias

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth e Storage) · Tesseract.js

## Como configurar

### Passo 1: criar o banco (uma vez só)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No menu da esquerda, clique em **SQL Editor** e depois em **New query**.
3. Abra o arquivo [`supabase/banco.sql`](supabase/banco.sql). No GitHub, use o botão **Copy raw file** (ícone de copiar, no canto superior direito do arquivo).
4. Cole no SQL Editor e clique em **Run**.
5. Deve aparecer **"Success. No rows returned"**. Pronto, o banco está criado.

> Se der algum erro, pode rodar o arquivo de novo: ele não apaga nada.
>
> **Atualizações do app:** quando o `banco.sql` mudar, basta rodá-lo de novo do mesmo jeito. Ele adiciona o que falta e mantém os dados.

### Passo 2: ligar o app ao banco

No Supabase, vá em **Project Settings → API** e copie a *Project URL* e a chave *anon public*. Crie um arquivo `.env.local` (copie o `.env.example`) e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=cole-aqui-a-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole-aqui-a-anon-key
```

### Passo 3: criar sua conta

Rode o app (`npm install` e depois `npm run dev`), abra http://localhost:3000 e clique em **Cadastre-se**.

**A primeira conta criada vira ADM automaticamente.** Depois, em **Organizações**, cadastre cada cliente e gere o convite do primeiro gestor dele; o gestor convida os próprios motoristas. Quem se cadastra sem convite fica na tela de código até ser convidado.

**Atualizando um banco já em uso:** rode o `supabase/banco.sql` de novo. Os dados existentes são mantidos e vão para uma organização chamada **Frota própria** (renomeie em *Organizações*); os usuários que eram comuns viram motoristas e o ADM promove quem for gestor.

> Por padrão o Supabase pede confirmação por e-mail. Para testar mais rápido, desligue em *Authentication → Sign In / Providers → Email → Confirm email*.

## Publicar (Vercel)

Importe o repositório na [Vercel](https://vercel.com), cadastre as duas variáveis `NEXT_PUBLIC_SUPABASE_*` e publique. Em *Authentication → URL Configuration* do Supabase, coloque a URL da Vercel como *Site URL*.

## Estrutura

```
supabase/banco.sql     banco completo: copiar e colar no SQL Editor
src/proxy.ts           exige login em todas as páginas (exceto /login)
src/lib/ocr.ts         leitura dos números nas fotos (Tesseract.js)
src/lib/regras.ts      regras de óleo, revisão e pneus (TWI)
src/components/FotoNumero.tsx   foto + leitura automática + campo para conferir
src/app/(app)/         telas de todos os usuários (o que aparece depende do papel)
src/app/(app)/admin/   painel do gestor/ADM, usuários, parâmetros e organizações
```
