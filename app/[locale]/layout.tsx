import { Auth0Provider } from "@auth0/nextjs-auth0";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { isValidLocale } from "@/lib/i18n";
import WeChatGuard from "@/components/WeChatGuard";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XV7GLZ82LV"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XV7GLZ82LV');
        `}
      </Script>
      <WeChatGuard />
      <Auth0Provider>{children}</Auth0Provider>
      <Analytics />
    </>
  );
}
