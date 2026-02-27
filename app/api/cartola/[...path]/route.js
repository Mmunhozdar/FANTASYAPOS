// app/api/cartola/[...path]/route.js
// Proxy para API do Cartola FC — resolve CORS

const CARTOLA_URLS = [
  "https://api.cartola.globo.com",
  "https://api.cartolafc.globo.com",
];

export async function GET(request, { params }) {
  const { path } = await params;
  const apiPath = "/" + path.join("/");

  for (const base of CARTOLA_URLS) {
    try {
      const res = await fetch(`${base}${apiPath}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MitouFC/1.0",
        },
        next: { revalidate: 30 }, // cache 30s no Vercel
      });

      if (res.ok) {
        const data = await res.json();
        return Response.json(data, {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        });
      }
    } catch (e) {
      console.warn(`[Proxy] fail ${base}${apiPath}:`, e.message);
    }
  }

  return Response.json(
    { error: "Cartola API indisponível" },
    { status: 502 }
  );
}
