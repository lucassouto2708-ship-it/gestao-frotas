import Link from "next/link";
import { CarFront, PlusSquare } from "lucide-react";
import { EstadoVazio, Pagina, Painel } from "@/components/Pagina";
import { Selo } from "@/components/Selo";
import { data, formatarPlaca, km, statusOleo, statusRevisao } from "@/lib/regras";
import { getProfile } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/types";

const textoNivel = { ok: "Em dia", atencao: "Em breve", critico: "Vencida" } as const;

export default async function Veiculos() {
  const { supabase } = await getProfile();
  const { data: lista } = await supabase.from("vehicles").select("*").order("placa");
  const veiculos = (lista ?? []) as Vehicle[];

  return (
    <Pagina
      titulo="Veículos"
      descricao="Consulte a ficha de cada veículo, registre manutenções e veja o histórico."
      acoes={<Link href="/veiculos/novo" className="botao"><PlusSquare size={15} /> Cadastrar veículo</Link>}
    >
      <Painel titulo="Frota" acoes={<span className="text-xs text-texto-2">{veiculos.length} veículos</span>} semPadding>
        {veiculos.length === 0 ? (
          <EstadoVazio
            icone={<CarFront size={28} strokeWidth={1.5} />}
            titulo="Nenhum veículo cadastrado"
            acao={<Link href="/veiculos/novo" className="botao">Cadastrar veículo</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Modelo</th>
                  <th className="num">Km atual</th>
                  <th>Troca de óleo</th>
                  <th>Revisão</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => {
                  const oleo = statusOleo(v), revisao = statusRevisao(v);
                  return (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/veiculos/${v.id}`} className="mono link font-semibold">{formatarPlaca(v.placa)}</Link>
                      </td>
                      <td>{v.modelo || <span className="text-texto-2">—</span>}</td>
                      <td className="num font-semibold">{km(v.km_atual)}</td>
                      {[
                        { s: oleo, d: v.data_ultima_troca_oleo },
                        { s: revisao, d: v.data_ultima_revisao },
                      ].map(({ s, d }, i) => (
                        <td key={i} className="whitespace-nowrap">
                          <Selo nivel={s.nivel}>{textoNivel[s.nivel]}</Selo>{" "}
                          <span className="text-xs text-texto-2">{d ? `última em ${data(d)}` : "sem registro"}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </Pagina>
  );
}
