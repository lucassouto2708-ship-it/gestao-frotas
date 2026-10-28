// Relatórios em PDF (gerados no próprio navegador). Layout simples e sóbrio, na mesma identidade do sistema.

export type Relatorio = {
  titulo: string;
  organizacao: string | null;
  veiculo: { placa: string; modelo: string; kmAtual: string };
  /** Pares "rótulo / valor" mostrados em faixa logo abaixo do título. */
  resumo: [string, string][];
  colunas: { titulo: string; direita?: boolean; largura?: number }[];
  linhas: string[][];
  vazio: string;
  nota?: string;
  emitidoPor: string;
  arquivo: string;
};

const AZUL: [number, number, number] = [30, 78, 140];
const TEXTO: [number, number, number] = [31, 41, 55];
const CINZA: [number, number, number] = [107, 114, 128];
const LINHA: [number, number, number] = [226, 229, 233];
const FUNDO: [number, number, number] = [243, 245, 248];

export async function gerarPdf(r: Relatorio) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14; // margem

  // Faixa do cabeçalho
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text("Gestão de Frotas", M, 10.5);
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(r.organizacao ?? "Controle de quilometragem, manutenção e pneus", M, 16.5);
  doc.setFontSize(9.5);
  doc.text(r.titulo, W - M, 10.5, { align: "right" });
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  doc.text(`Emitido em ${agora}`, W - M, 16.5, { align: "right" });

  // Identificação do veículo + resumo, em uma faixa só
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(`Veículo ${r.veiculo.placa}`, M, 32);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...CINZA);
  doc.text(`${r.veiculo.modelo || "Modelo não informado"}  |  Km atual: ${r.veiculo.kmAtual}`, M, 38);

  const itens: [string, string][] = r.resumo;
  const larguraCaixa = (W - 2 * M) / Math.max(1, itens.length);
  doc.setFillColor(...FUNDO).setDrawColor(...LINHA);
  doc.rect(M, 43, W - 2 * M, 14, "FD");
  itens.forEach(([rotulo, valor], i) => {
    const x = M + i * larguraCaixa + 4;
    if (i > 0) doc.line(M + i * larguraCaixa, 45, M + i * larguraCaixa, 55);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text(rotulo.toUpperCase(), x, 48.5);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXTO);
    doc.text(valor, x, 54);
  });

  if (r.linhas.length === 0) {
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...CINZA);
    doc.text(r.vazio, W / 2, 85, { align: "center" });
  } else {
    const colunas = r.colunas;
    const fixas = colunas.reduce((s, c) => s + (c.largura ?? 0), 0);
    const livres = colunas.filter((c) => !c.largura).length;
    autoTable(doc, {
      startY: 62,
      head: [colunas.map((c) => c.titulo)],
      body: r.linhas,
      theme: "plain",
      margin: { left: M, right: M, bottom: 16 },
      tableWidth: W - 2 * M,
      styles: { font: "helvetica", fontSize: 8.5, textColor: TEXTO, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, lineColor: LINHA, lineWidth: 0, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: Object.fromEntries(
        colunas.map((c, i) => [
          i,
          { halign: c.direita ? "right" : "left", cellWidth: c.largura ?? (W - 2 * M - fixas) / Math.max(1, livres) },
        ]),
      ),
      didParseCell: (d) => {
        if (d.section === "head") d.cell.styles.halign = colunas[d.column.index].direita ? "right" : "left";
      },
      didDrawCell: (d) => {
        // Linha fina separando as linhas do corpo
        if (d.section === "body") {
          doc.setDrawColor(...LINHA).setLineWidth(0.2);
          doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        }
      },
    });
    if (r.nota) {
      const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
      doc.text(r.nota, M, Math.min(y, H - 18));
    }
  }

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINHA).setLineWidth(0.3);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text(`Gestão de Frotas${r.organizacao ? `  |  ${r.organizacao}` : ""}  |  Emitido por ${r.emitidoPor}`, M, H - 6.5);
    doc.text(`Página ${p} de ${total}`, W - M, H - 6.5, { align: "right" });
  }

  doc.save(r.arquivo);
}
