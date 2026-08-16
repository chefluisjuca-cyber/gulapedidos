export interface CepResult {
  street: string;
  bairro: string;
  city: string;
  state: string;
}

async function lookupViaCep(cep: string): Promise<CepResult | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();
  if (data.erro) return null;
  return {
    street: data.logradouro ?? '',
    bairro: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? '',
  };
}

async function lookupPostmon(cep: string): Promise<CepResult | null> {
  const res = await fetch(`https://api.postmon.com.br/v1/cep/${cep}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    street: data.logradouro ?? '',
    bairro: data.bairro ?? '',
    city: data.cidade ?? '',
    state: data.estado ?? '',
  };
}

export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const primary = await lookupViaCep(digits);
    if (primary && primary.street) return primary;
  } catch { /* fall through to secondary */ }
  try {
    const secondary = await lookupPostmon(digits);
    if (secondary) return secondary;
  } catch { /* both failed */ }
  return null;
}
