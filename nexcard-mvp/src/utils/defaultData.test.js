import { initialMockData } from './defaultData';

describe('initial profile defaults', () => {
  it('no expone datos demo/personales en perfiles nuevos', () => {
    expect(initialMockData).toMatchObject({
      full_name: '',
      profession: '',
      company: '',
      avatar_url: '',
      contact_email: '',
      contact_phone: '',
      whatsapp: '',
      bank_enabled: false,
      bank_name: '',
      bank_type: '',
      bank_number: '',
      bank_rut: '',
      bank_email: '',
      website_url: '',
      portfolio_url: '',
      calendar_url: '',
      instagram: '',
      linkedin: '',
      facebook: '',
    });
  });
});
