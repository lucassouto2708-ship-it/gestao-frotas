# Gestão de Frotas

Aplicativo web (PWA, funciona no celular e pode ser instalado na tela inicial) para controlar a frota:

- **Cadastro de carros**: placa, modelo e km inicial do mostrador (com foto opcional).
- **Viagens**: o motorista tira foto do mostrador na saída e na chegada. O app calcula os km rodados.
- **Manutenção**: aviso de troca de óleo (padrão a cada **10.000 km**) e revisão (padrão a cada **20.000 km**), com alerta ao atingir 90% do intervalo. O ADM registra a manutenção feita e o contador zera. Os intervalos podem ser alterados por carro.
- **Pneus (TWI)**: medição do sulco dos 4 pneus (dianteiro/traseiro, esquerdo/direito) com foto do medidor. Abaixo de 1,6 mm (TWI, mínimo legal) aparece "Trocar"; abaixo de 3 mm, "Atenção".
- **Leitura automática das fotos (OCR)**: o [Tesseract.js](https://github.com/naptha/tesseract.js) roda no próprio navegador, de graça e sem chave de API. Ele lê o número da foto e preenche o campo. O usuário sempre confere e pode corrigir.

## Tipos de usuário

| | Comum | ADM |
|---|---|---|
| Cadastrar carro | ✅ | ✅ |
| Iniciar/finalizar viagem com fotos | ✅ (só as próprias) | ✅ |
| Medir pneus | ✅ (só as próprias) | ✅ |
| Painel com todos os carros, km do mês, alertas | ❌ | ✅ |
| Ver fotos e histórico de todos | ❌ | ✅ |
| Registrar manutenção, alterar intervalos, excluir carro | ❌ | ✅ |
| Promover usuários a ADM | ❌ | ✅ |

As permissões são garantidas no próprio banco (Row Level Security do Supabase), não só na tela.

## Tecnologias

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth e Storage) · Tesseract.js

## Como configurar

1. **Crie um projeto** em [supabase.com](https://supabase.com).
2. No **SQL Editor** do Supabase, cole e rode o conteúdo de [`supabase/migrations/0001_inicial.sql`](supabase/migrations/0001_inicial.sql). Isso cria as tabelas, as regras de acesso e o bucket privado `fotos`.
3. Copie `.env.example` para `.env.local` e preencha com os dados de *Project Settings → API*:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Rode localmente:
   ```bash
   npm install
   npm run dev
   ```
   Abra http://localhost:3000 e crie sua conta.
5. **Torne-se ADM.** Toda conta nova entra como *comum*. Para o primeiro ADM, rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```
   Depois disso, os próximos ADMs podem ser promovidos pela tela **Usuários**.

> Por padrão o Supabase exige confirmação de e-mail no cadastro. Para testar mais rápido, desligue em *Authentication → Sign In / Providers → Email → Confirm email*.

## Publicar (Vercel)

Importe o repositório na [Vercel](https://vercel.com), cadastre as duas variáveis `NEXT_PUBLIC_SUPABASE_*` e publique. Em *Authentication → URL Configuration* do Supabase, coloque a URL da Vercel como *Site URL*.

## Estrutura

```
supabase/migrations/   esquema do banco, gatilhos e permissões
src/proxy.ts           exige login em todas as páginas (exceto /login)
src/lib/ocr.ts         leitura dos números nas fotos (Tesseract.js)
src/lib/regras.ts      regras de óleo, revisão e pneus (TWI)
src/components/FotoNumero.tsx   foto + leitura automática + campo para conferir
src/app/(app)/         telas do usuário comum
src/app/(app)/admin/   painel do ADM
```
