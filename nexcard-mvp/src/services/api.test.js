import { getErrorMessage, getLastOrderProof, setLastOrderProof } from './api';

describe('getErrorMessage', () => {
  it('traduce errores conocidos a mensajes amigables', () => {
    expect(getErrorMessage(new Error('Failed to fetch'))).toBe('Sin conexión. Verifica tu internet e intenta nuevamente.');
    expect(getErrorMessage(new Error('23505 duplicate key'))).toBe('Este registro ya existe.');
  });

  it('usa un fallback seguro para errores desconocidos', () => {
    expect(getErrorMessage(new Error('algo raro'))).toBe(
      'Ocurrió un error inesperado. Intenta nuevamente o contacta a hola@nexcard.cl'
    );
  });
});

describe('same-tab guest order proof storage', () => {
  const key = 'nexcard_last_order_proof';
  const proof = {
    orderId: 'order-1',
    clientCheckoutAttemptId: 'attempt-1',
    clientCheckoutFingerprint: 'fingerprint-1',
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('escribe y lee solo la prueba mínima requerida', () => {
    setLastOrderProof({ ...proof, customerEmail: 'cliente@nexcard.cl' });

    expect(getLastOrderProof()).toEqual(proof);
    expect(JSON.parse(sessionStorage.getItem(key))).toEqual(proof);
  });

  it('elimina la prueba cuando recibe null', () => {
    setLastOrderProof(proof);
    setLastOrderProof(null);

    expect(sessionStorage.getItem(key)).toBeNull();
    expect(getLastOrderProof()).toBeNull();
  });

  it('retorna null ante JSON corrupto', () => {
    sessionStorage.setItem(key, '{invalid-json');

    expect(getLastOrderProof()).toBeNull();
  });

  it('reemplaza la prueba previa al iniciar un checkout nuevo', () => {
    setLastOrderProof(proof);
    const nextProof = {
      orderId: 'order-2',
      clientCheckoutAttemptId: 'attempt-2',
      clientCheckoutFingerprint: 'fingerprint-2',
    };

    setLastOrderProof(nextProof);

    expect(getLastOrderProof()).toEqual(nextProof);
    expect(JSON.parse(sessionStorage.getItem(key))).toEqual(nextProof);
  });
});
