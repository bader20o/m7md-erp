export const locales = ["en", "ar"] as const;
export type AppLocale = (typeof locales)[number];

type Dictionary = Record<string, string>;

const en: Dictionary = {
  appName: "Hybrid & Electric Service Center",
  navServices: "Services",
  navAbout: "About",
  navMemberships: "Memberships",
  navBook: "Book",
  navMyBookings: "My Bookings",
  navAdmin: "Admin",
  navLogin: "Login",
  navRegister: "Register",
  heroTitle: "Reliable Maintenance for Hybrid & Electric Cars",
  heroSubtitle: "Book services, track memberships, and manage your car care in one place.",
  servicesTitle: "Services",
  authLoginTitle: "Sign In",
  authRegisterTitle: "Create Account"
};

const ar: Dictionary = {
  appName: "مركز صيانة السيارات الهجينة والكهربائية",
  navServices: "الخدمات",
  navAbout: "من نحن",
  navMemberships: "العضويات",
  navBook: "حجز موعد",
  navMyBookings: "حجوزاتي",
  navAdmin: "الإدارة",
  navLogin: "تسجيل الدخول",
  navRegister: "إنشاء حساب",
  heroTitle: "صيانة موثوقة للسيارات الهجينة والكهربائية",
  heroSubtitle: "احجز الخدمات وتابع العضويات وإدارة صيانة سيارتك في مكان واحد.",
  servicesTitle: "الخدمات",
  authLoginTitle: "تسجيل الدخول",
  authRegisterTitle: "إنشاء حساب"
};

const dictionaries: Record<AppLocale, Dictionary> = { en, ar };

export function getDictionary(locale: string): Dictionary {
  if (locale === "ar") {
    return dictionaries.ar;
  }
  return dictionaries.en;
}

export function getDirection(locale: string): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
