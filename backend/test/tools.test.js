import { describe, it, expect } from 'vitest';
import { consultarFaixaSalarial, proximoNivel } from '../src/core/tools.js';

describe('proximoNivel', () => {
  it('sobe a escada junior -> pleno -> senior -> staff', () => {
    expect(proximoNivel('junior')).toBe('pleno');
    expect(proximoNivel('pleno')).toBe('senior');
    expect(proximoNivel('senior')).toBe('staff');
  });
  it('staff não tem próximo nível', () => {
    expect(proximoNivel('staff')).toBe(null);
  });
});

describe('consultarFaixaSalarial', () => {
  it('faz match exato de cargo × senioridade', () => {
    const f = consultarFaixaSalarial('Analista de Dados', 'pleno');
    expect(f.match_exato).toBe(true);
    expect(f.mediana).toBe(6560);
    expect(f.cargo).toBe('Analista de Dados');
  });

  it('é tolerante a acento/caixa', () => {
    const f = consultarFaixaSalarial('cientista de dados', 'senior');
    expect(f.match_exato).toBe(true);
    expect(f.mediana).toBe(14919);
  });

  it('staff sempre colapsa na linha Geral', () => {
    const f = consultarFaixaSalarial('Engenheiro de Dados', 'staff');
    expect(f.cargo).toBe('Geral (todas as funções)');
    expect(f.mediana).toBe(17805);
    // cargo específico pedido em staff => não é match exato
    expect(f.match_exato).toBe(false);
  });

  it('staff com cargo Geral é match exato', () => {
    const f = consultarFaixaSalarial('Geral (todas as funções)', 'staff');
    expect(f.match_exato).toBe(true);
  });

  it('sem match exato devolve recorte mais próximo com match_exato=false', () => {
    const f = consultarFaixaSalarial('Analista de Negócios', 'pleno');
    expect(f).not.toBeNull();
    expect(f.match_exato).toBe(false);
    expect(f.senioridade).toBe('pleno');
  });
});
