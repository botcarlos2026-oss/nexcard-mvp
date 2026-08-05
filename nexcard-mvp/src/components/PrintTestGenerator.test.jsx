import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PrintTestGenerator from './PrintTestGenerator';

vi.mock('./AdminShell', () => ({
  default: ({ children }) => <div data-testid="admin-shell">{children}</div>,
}));

function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('PrintTestGenerator', () => {
  it('renders SVG previews as encoded image resources and keeps print/download actions wired', () => {
    const fakeWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWindow);
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { container, unmount } = render(<PrintTestGenerator />);

    const previews = container.querySelectorAll('img[alt^="Previsualización Carta"]');
    expect(previews).toHaveLength(2);

    previews.forEach((preview) => {
      expect(preview.tagName).toBe('IMG');
      expect(preview.getAttribute('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(preview.getAttribute('src')).toContain('%3Csvg');
      expect(preview.getAttribute('src')).not.toContain('<svg');
    });

    const printButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => button.textContent === 'Imprimir esta carta',
    );
    const downloadButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => button.textContent === 'Descargar SVG',
    );

    expect(printButtons).toHaveLength(2);
    expect(downloadButtons).toHaveLength(2);

    act(() => {
      printButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(fakeWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('<title>Carta 1 — Tipografía y Líneas</title>'));
    expect(fakeWindow.print).toHaveBeenCalled();

    act(() => {
      downloadButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

    unmount();
  });
});
