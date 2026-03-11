import Link from "next/link";
import { getDictionary, isValidLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Welcome to AutoClaw!",
};

export default async function SuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.success;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md text-center px-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-4">{t.title}</h1>
        <p className="text-gray-500 mb-8">{t.message}</p>
        <Link href={`/${locale}`} className="inline-block bg-red-800 hover:bg-red-900 text-white px-6 py-3 rounded-lg font-medium transition-colors">
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
