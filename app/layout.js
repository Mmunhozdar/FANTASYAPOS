import './globals.css';

export const metadata = {
  title: 'Mitou FC — Escalação Inteligente · Cartola FC 2026',
  description: 'Gere escalações otimizadas com IA para o Cartola FC 2026. Escolha formação, orçamento e estratégia e receba o time ideal com dados ao vivo. mitoufc.com.br',
  keywords: ['cartola fc', 'cartola 2026', 'escalação', 'mitou', 'fantasy', 'brasileirão', 'mitoufc', 'gerador escalação', 'escalar cartola com IA'],
  openGraph: {
    title: 'Mitou FC — Escalação Inteligente · Cartola FC 2026',
    description: 'Sua escalação otimizada com IA para mitar no Cartola FC. Dados ao vivo, 4 estratégias, 7 formações.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Mitou FC',
    url: 'https://mitoufc.com.br',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mitou FC — Escalação Inteligente · Cartola FC 2026',
    description: 'Gere escalações otimizadas com IA para mitar no Cartola FC 2026.',
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0a0f18',
  metadataBase: new URL('https://mitoufc.com.br'),
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
