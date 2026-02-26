import './globals.css';

export const metadata = {
  title: 'Apostômetro Fantasy — Cartola FC 2026',
  description: 'Gerador de escalação com IA para o Cartola FC 2026. Escolha formação, orçamento e estratégia e receba a escalação ideal com dados ao vivo da API.',
  keywords: ['cartola fc', 'cartola 2026', 'escalação', 'fantasy', 'brasileirão', 'apostometro'],
  openGraph: {
    title: 'Apostômetro Fantasy — Cartola FC 2026',
    description: 'Gerador de escalação com IA para o Cartola FC. Dados ao vivo, otimização inteligente.',
    type: 'website',
    locale: 'pt_BR',
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#050a0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
