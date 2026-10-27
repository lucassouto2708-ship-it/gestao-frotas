# Gestão de Frotas

Aplicativo web (PWA, funciona no celular e pode ser instalado na tela inicial) para controlar a frota:

- **Cadastro de carros**: placa, modelo e km inicial do mostrador (com foto opcional).
- **Viagens**: o motorista tira foto do mostrador na saída e na chegada. O app calcula os km rodados.
- **Manutenção**: aviso de troca de óleo (padrão a cada **10.000 km**) e revisão (padrão a cada **20.000 km**), com alerta ao atingir 90% do intervalo. No cadastro do carro dá para informar a última troca de óleo e a última revisão. Depois, qualquer usuário registra serviços (óleo, revisão, pneus, freios, bateria, outros) com km, data e custo, e cada carro tem seu **histórico de manutenção**. Troca de óleo e revisão zeram o contador. Só o ADM exclui registros. Os intervalos podem ser alterados por carro.
- **Pneus (TWI)**: medição do sulco dos 4 pneus (dianteiro/traseiro, esquerdo/direito) com foto do medidor. Abaixo de 1,6 mm (TWI, mínimo legal) aparece "Trocar"; abaixo de 3 mm, "Atenção".
- **Leitura das fotos com marcação**: depois de tirar a foto, o usuário marca com um retângulo onde estão os números (no medidor de pneu o app já sugere a área sozinho). O app lê só aquele trecho: primeiro com um leitor próprio de visores de 7 segmentos (medidor de sulco e odômetros digitais, de fundo claro ou escuro) e, se não conseguir, com o [Tesseract.js](https://github.com/naptha/tesseract.js). Tudo roda no próprio celular, de graça e sem chave de API. O valor é sempre conferido pelo usuário antes de salvar. O sulco do pneu é guardado com 2 casas decimais (ex.: 1,27 mm).

## Tipos de usuário

| | Comum | ADM |
|---|---|---|
| Ver e usar só os carros vinculados a ele (o ADM vincula na ficha do veículo) | ✅ | todos |
| Cadastrar carro (fica vinculado a quem cadastrou; com última troca de óleo/revisão) | ✅ | ✅ |
| Registrar manutenção e ver histórico do carro | ✅ | ✅ |
| Excluir registro de manutenção | ❌ | ✅ |
| Iniciar/finalizar viagem com fotos | ✅ (só as próprias) | ✅ |
| Medir pneus | ✅ (só as próprias) | ✅ |
| Painel com todos os carros, km do mês, alertas | ❌ | ✅ |
| Ver fotos e histórico de todos | ❌ | ✅ |
| Parâmetros de manutenção: padrão da frota e intervalos de cada carro (aba Parâmetros) | ❌ | ✅ |
| Excluir carro, vincular/desvincular motoristas | ❌ | ✅ |
| Promover usuários a ADM | ❌ | ✅ |

As permissões são garantidas no próprio banco (Row Level Security do Supabase), não só na tela.

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

**A primeira conta criada vira ADM automaticamente.** As próximas entram como usuário comum. Para promover alguém a ADM, use a tela **Usuários** dentro do app.

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
src/app/(app)/         telas do usuário comum
src/app/(app)/admin/   painel do ADM
```
