import { getErrorMessage } from './api';

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
