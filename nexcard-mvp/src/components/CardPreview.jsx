import { generateCardSVG } from '../utils/cardTemplates';

export default function CardPreview({
  template = 'minimal',
  name = 'Tu Nombre',
  jobTitle = 'Tu Cargo',
  company = '',
  primaryColor = '#10B981',
  size = 'full',
}) {
  const width = size === 'thumb' ? 170 : 340;
  const height = size === 'thumb' ? 108 : 216;

  const svg = generateCardSVG(template, { name, jobTitle, company, primaryColor });

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 2px 12px 0 rgba(0,0,0,0.18)',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
