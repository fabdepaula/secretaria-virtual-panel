export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 11);

  if (d.length <= 3) return a;
  if (d.length <= 6) return `${a}.${b}`;
  if (d.length <= 9) return `${a}.${b}.${c}`;
  return `${a}.${b}.${c}-${e}`;
}

export function formatCnpj(digits: string): string {
  const d = onlyDigits(digits).slice(0, 14);
  const a = d.slice(0, 2);
  const b = d.slice(2, 5);
  const c = d.slice(5, 8);
  const d4 = d.slice(8, 12);
  const e = d.slice(12, 14);

  if (d.length <= 2) return a;
  if (d.length <= 5) return `${a}.${b}`;
  if (d.length <= 8) return `${a}.${b}.${c}`;
  if (d.length <= 12) return `${a}.${b}.${c}/${d4}`;
  return `${a}.${b}.${c}/${d4}-${e}`;
}

function isAllSame(digits: string): boolean {
  return digits.length > 0 && digits.split("").every((c) => c === digits[0]);
}

export function validateCPF(digitsRaw: string): boolean {
  const digits = onlyDigits(digitsRaw);
  if (digits.length !== 11) return false;
  if (isAllSame(digits)) return false;

  const nums = digits.split("").map((c) => Number(c));

  // 1st check digit
  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += nums[i] * (10 - i);
  const mod1 = sum1 % 11;
  const check1 = mod1 < 2 ? 0 : 11 - mod1;
  if (check1 !== nums[9]) return false;

  // 2nd check digit
  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += nums[i] * (11 - i);
  const mod2 = sum2 % 11;
  const check2 = mod2 < 2 ? 0 : 11 - mod2;
  return check2 === nums[10];
}

export function validateCNPJ(digitsRaw: string): boolean {
  const digits = onlyDigits(digitsRaw);
  if (digits.length !== 14) return false;
  if (isAllSame(digits)) return false;

  const nums = digits.split("").map((c) => Number(c));

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calc = (len: number, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const check1 = calc(12, weights1);
  if (check1 !== nums[12]) return false;

  const check2 = calc(13, weights2);
  return check2 === nums[13];
}

export function formatDocumento(tipoCliente: string, digitsRaw: string): string {
  const digits = onlyDigits(digitsRaw);
  if (tipoCliente === "PF") return formatCpf(digits);
  return formatCnpj(digits);
}

export function validateDocumento(tipoCliente: string, digitsRaw: string): boolean {
  if (tipoCliente === "PF") return validateCPF(digitsRaw);
  return validateCNPJ(digitsRaw);
}

