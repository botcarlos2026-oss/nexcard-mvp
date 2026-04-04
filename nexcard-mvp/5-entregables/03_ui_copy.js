// ============================================================
// NexCard MVP — UI Copy & Microcopy
// Archivo de referencia para todos los textos de la app.
// Importar donde sea necesario o usar como fuente de verdad.
// ============================================================

export const copy = {

  // ─────────────────────────────────────
  // AUTH — AuthPage.jsx
  // ─────────────────────────────────────
  auth: {
    login: {
      title: 'Bienvenido de nuevo.',
      subtitle: 'Accede a tu panel y administra tu perfil, pedidos y operación.',
      submit: 'Entrar',
      switchMode: '¿No tienes cuenta? Regístrate',
    },
    register: {
      title: 'Crea tu NexCard.',
      subtitle: 'Tu primera tarjeta digital en menos de 5 minutos.',
      submit: 'Crear cuenta',
      switchMode: '¿Ya tienes cuenta? Inicia sesión',
    },
    errors: {
      invalid_credentials:   'Correo o contraseña incorrectos. Intenta de nuevo.',
      email_not_confirmed:   'Revisa tu correo y confirma tu cuenta antes de ingresar.',
      user_not_found:        'No encontramos una cuenta con ese correo.',
      email_already_in_use:  'Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?',
      weak_password:         'La contraseña debe tener al menos 8 caracteres.',
      network_error:         'Problema de conexión. Verifica tu internet e intenta de nuevo.',
      too_many_requests:     'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
      generic:               'Algo salió mal. Por favor intenta de nuevo.',
    },
    placeholders: {
      email:    'correo@ejemplo.com',
      password: '••••••••',
    },
    security_badge: 'Acceso seguro vía Supabase Auth',
    back_to_landing: 'Volver a inicio',
  },

  // ─────────────────────────────────────
  // SETUP WIZARD — SetupWizard.jsx
  // ─────────────────────────────────────
  setup: {
    steps: {
      account_type: {
        title: '¿Para quién es esta NexCard?',
        subtitle: 'Personalizaremos tu experiencia según tu perfil.',
        personal: {
          label: 'Uso Personal',
          desc: 'Para profesionales independientes y networking.',
        },
        business: {
          label: 'Empresa / Pyme',
          desc: 'Para equipos de ventas, locales o flotas corporativas.',
        },
      },
      basic_info: {
        title: 'Comencemos con lo básico.',
        subtitle: '¿Cómo quieres aparecer en tu perfil?',
        name_placeholder_personal:   'Tu nombre completo',
        name_placeholder_business:   'Nombre de la empresa',
        role_placeholder_personal:   'Tu profesión o cargo',
        role_placeholder_business:   'Rubro o especialidad',
      },
      bio: {
        title: 'Cuéntales algo más.',
        subtitle: 'Bio corta (opcional). Puedes saltar este paso.',
        placeholder: 'Ej: Ayudo a pymes a crecer con tecnología y buenas ideas...',
        skip: 'Saltar este paso',
      },
      color: {
        title: 'Tu color de marca.',
        subtitle: 'Elige un color o personaliza el tuyo.',
        custom_label: 'Personalizar',
      },
      whatsapp: {
        title: 'Línea directa.',
        subtitle: 'Tu número de WhatsApp para recibir contactos al instante.',
        placeholder: 'Ej: 56912345678 (con código de país)',
        hint: 'El código de Chile es 56. Sin el +.',
      },
    },
    nav: {
      next: 'Siguiente',
      prev: 'Atrás',
      finish: 'Crear mi NexCard',
    },
    errors: {
      name_required: 'Necesitamos tu nombre para continuar.',
      save_failed:   'No pudimos guardar tu perfil. Intenta de nuevo.',
    },
  },

  // ─────────────────────────────────────
  // USER EDITOR — UserEditor.jsx
  // ─────────────────────────────────────
  editor: {
    tabs: {
      stats:   'Stats',
      basic:   'Básico',
      design:  'Diseño',
      links:   'Enlaces',
      bank:    'Pago',
      content: 'Landing',
    },
    save: {
      button:  'Guardar',
      saving:  'Guardando…',
      success: 'Cambios guardados correctamente.',
      error:   'No pudimos guardar los cambios. Intenta de nuevo.',
    },
    avatar: {
      label:     'Foto de perfil',
      uploading: 'Subiendo imagen…',
      error:     'No pudimos subir la imagen. Prueba con otro archivo.',
      hint:      'JPG o PNG. Máximo 5 MB.',
    },
    stats: {
      taps_label:       'Interacciones totales (taps)',
      status_label:     'Estado perfil',
      account_label:    'Tipo de cuenta',
      empty_hint:       'Aún no tienes visitas. Comparte tu tarjeta o link de perfil.',
    },
    bank: {
      toggle_label:   'Mostrar datos de transferencia',
      toggle_hint:    'Activa el acordeón de datos bancarios en tu perfil público.',
      fields: {
        bank_name:   'Banco',
        bank_type:   'Tipo de cuenta',
        bank_number: 'Número de cuenta',
        bank_rut:    'RUT del titular',
        bank_email:  'Email de notificación',
      },
    },
    preview_link: 'Ver mi NexCard pública',
  },

  // ─────────────────────────────────────
  // PERFIL PÚBLICO — NexCardProfile.jsx
  // ─────────────────────────────────────
  profile: {
    save_contact:  'Guardar Contacto',
    share:         'Compartir perfil',
    bank_accordion:'Datos para transferencia',
    copy_success:  '¡Copiado!',
    links: {
      whatsapp:  'WhatsApp',
      calendar:  'Agendar reunión',
      instagram: 'Instagram',
      linkedin:  'LinkedIn',
      website:   'Sitio web',
    },
    error: {
      not_found: 'Este perfil no existe o fue desactivado.',
      generic:   'No pudimos cargar el perfil. Intenta de nuevo.',
    },
    branding: 'Hecho con NexCard',
  },

  // ─────────────────────────────────────
  // ADMIN DASHBOARD — AdminDashboard.jsx
  // ─────────────────────────────────────
  admin: {
    title:    'NexCard Control Center',
    subtitle: 'Conversión, perfiles, pedidos y salud operativa.',
    stats: {
      revenue:        'Ingresos cobrados',
      profiles:       'Perfiles activos',
      pending_orders: 'Pedidos abiertos',
    },
    table: {
      search_placeholder: 'Filtrar por nombre…',
      headers: {
        user:         'Usuario',
        taps:         'Taps',
        whatsapp:     'WhatsApp',
        vcard:        'vCard',
        account_type: 'Tipo',
        actions:      'Acciones',
      },
      actions: {
        view_profile:  'Ver perfil',
        download_qr:   'Descargar QR',
      },
    },
    empty: {
      users:  'Aún no hay perfiles registrados. Los verás aquí una vez que tus clientes activen sus tarjetas.',
      orders: 'No hay pedidos aún. Aquí aparecerán las órdenes cuando lleguen.',
    },
    orders: {
      title:  'Últimos pedidos',
      empty:  'Sin pedidos recientes.',
    },
    status: {
      active:    'Activo',
      disabled:  'Desactivado',
      pending:   'Pendiente',
    },
    fulfillment: {
      new:       'Nuevo',
      printing:  'En impresión',
      shipping:  'En despacho',
      delivered: 'Entregado',
      canceled:  'Cancelado',
    },
    payment: {
      pending:    'Pendiente',
      authorized: 'Autorizado',
      paid:       'Pagado',
      failed:     'Fallido',
      refunded:   'Reembolsado',
    },
  },

  // ─────────────────────────────────────
  // INVENTORY DASHBOARD — InventoryDashboard.jsx
  // ─────────────────────────────────────
  inventory: {
    title:   'Inventario y Logística',
    subtitle:'Control de stock para producción, impresión y cumplimiento.',
    add_btn: '+ Registrar entrada / compra',
    kpis: {
      stock_value:       'Valorización stock',
      print_capacity:    'Capacidad de impresión',
      critical_items:    'Ítems críticos',
    },
    table: {
      headers: {
        item:         'Ítem / Maquinaria',
        category:     'Categoría',
        stock:        'Stock actual',
        unit_cost:    'Costo unitario',
        status:       'Estado',
        actions:      'Acciones',
      },
    },
    status: {
      ok:       'OK',
      critical: 'Stock crítico',
    },
    empty: {
      title:   'Sin ítems en inventario.',
      subtitle:'Registra tu primer ítem para comenzar a trackear el stock.',
      cta:     'Agregar ítem',
    },
    printer: {
      label:       'Fargo DTC1500',
      status_ok:   'Operativa',
      status_warn: 'Requiere mantención',
      head_life:   'vida útil cabezal',
    },
  },

  // ─────────────────────────────────────
  // ESTADOS GENÉRICOS
  // ─────────────────────────────────────
  global: {
    loading:      'Cargando…',
    saving:       'Guardando…',
    error_title:  'Algo salió mal',
    error_generic:'Ocurrió un error inesperado. Por favor recarga la página.',
    not_found:    'Página no encontrada.',
    back_home:    'Volver al inicio',
    logout:       'Cerrar sesión',
    cancel:       'Cancelar',
    confirm:      'Confirmar',
    save:         'Guardar',
    edit:         'Editar',
    delete:       'Eliminar',
    copied:       '¡Copiado!',
  },

};
