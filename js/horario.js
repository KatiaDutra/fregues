// horario.js
// Calcula se a loja está aberta e descreve os dias de funcionamento.
// Os dias seguem o padrão do JavaScript: 0 = domingo, 1 = segunda ... 6 = sábado.

const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function paraMinutos(horaTexto) {
  const [horas, minutos] = horaTexto.split(":").map(Number);
  return horas * 60 + minutos;
}

export function statusDaLoja(horario, agora = new Date()) {
  const hoje = agora.getDay();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const abre = paraMinutos(horario.abre);
  const fecha = paraMinutos(horario.fecha);
  const abreHoje = horario.diasDaSemana.includes(hoje);

  if (abreHoje && minutosAgora >= abre && minutosAgora < fecha) {
    return { aberta: true, resumo: `Aberto até ${horario.fecha}` };
  }

  if (abreHoje && minutosAgora < abre) {
    return { aberta: false, resumo: `Fechado, abre hoje às ${horario.abre}` };
  }

  // Procura o próximo dia de funcionamento
  for (let dias = 1; dias <= 7; dias++) {
    const dia = (hoje + dias) % 7;
    if (horario.diasDaSemana.includes(dia)) {
      const quando = dias === 1 ? "amanhã" : NOMES_DOS_DIAS[dia];
      return { aberta: false, resumo: `Fechado, abre ${quando} às ${horario.abre}` };
    }
  }

  return { aberta: false, resumo: "Fechado" };
}

// Transforma [2, 3, 4, 5, 6, 0] em "de terça a domingo"
export function descreverDias(diasDaSemana) {
  const ordemDaSemana = [1, 2, 3, 4, 5, 6, 0];
  const dias = ordemDaSemana.filter((dia) => diasDaSemana.includes(dia));

  const sequencias = [];
  let atual = [dias[0]];

  for (let i = 1; i < dias.length; i++) {
    const anterior = ordemDaSemana.indexOf(dias[i - 1]);
    if (ordemDaSemana.indexOf(dias[i]) === anterior + 1) {
      atual.push(dias[i]);
    } else {
      sequencias.push(atual);
      atual = [dias[i]];
    }
  }
  sequencias.push(atual);

  const partes = sequencias.map((sequencia) => {
    const primeiro = NOMES_DOS_DIAS[sequencia[0]];
    const ultimo = NOMES_DOS_DIAS[sequencia[sequencia.length - 1]];
    return sequencia.length > 2 ? `de ${primeiro} a ${ultimo}` : sequencia.map((d) => NOMES_DOS_DIAS[d]).join(" e ");
  });

  // "segunda, quarta e sexta"
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}` : partes[0];
}
