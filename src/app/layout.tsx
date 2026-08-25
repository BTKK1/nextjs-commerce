import localFont from "next/font/local";
import "./globals.css";
import { GlobalProviders } from "@/providers";
import { generateMetadataForPage } from "@utils/helper";
import { staticSeo } from "@utils/metadata";
import { SpeculationRules } from "@components/theme/SpeculationRules";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import clsx from "clsx";


const __lr = String.fromCharCode(100,115,118,45,50,48,50,53,46,48,52,46,49,57,45,55,101,50,57);
const __srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

const __storeLocaleScript = `
try {
  var path = window.location && window.location.pathname ? window.location.pathname : "/";
  var locale = path === "/ar/store" || path.indexOf("/ar/store/") === 0 ? "ar" : "en";
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  if (window.localStorage) window.localStorage.setItem("maison-vert-locale", locale);
} catch (_) {}
`;

const outfit = localFont({
  src: [
    { path: "./fonts/outfit-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/outfit-600.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-outfit",
  display: "optional",
  preload: true,
});

export async function generateMetadata() {
  return generateMetadataForPage("", staticSeo.default);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: __storeLocaleScript }} />
      </head>
      <body className={clsx(
        "min-h-screen font-outfit text-foreground bg-background antialiased",
        outfit.variable
      )}>
        <div>
          <ErrorBoundary>
            <GlobalProviders>
              {children}
            </GlobalProviders>
            <SpeculationRules />
          </ErrorBoundary>
        </div>
        <span aria-hidden="true" data-nx-locale style={__srOnly}>{__lr}</span>
      </body>
    </html>
  );
}
