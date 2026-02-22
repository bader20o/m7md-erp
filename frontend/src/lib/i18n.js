import { store } from './store.js';

const en = {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.logout': 'Logout',
    'common.search': 'Search...',

    // Navigation
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.about': 'About Us',
    'nav.contact': 'Contact',
    'nav.login': 'Log In',
    'nav.register': 'Sign Up',
    'nav.dashboard': 'Dashboard',

    // Hero
    'hero.title': 'Premium Care for Hybrid & Electric Vehicles',
    'hero.subtitle': 'Experience dealership-level diagnostics and service with transparent pricing and unmatched trust.',
    'hero.book_now': 'Book Now',
    'hero.view_services': 'View Services',

    // Services
    'services.title': 'Our Services',
    'services.duration': '{min} min',
    'services.price': 'From {price} JOD',
    'services.book': 'Book Service',

    // Booking
    'booking.step1': 'Select Service',
    'booking.step2': 'Choose Time',
    'booking.step3': 'Confirm',
    'booking.date': 'Date',
    'booking.time': 'Time',
    'booking.notes': 'Additional Notes',
    'booking.submit': 'Confirm Booking',

    // Auth
    'auth.login_title': 'Welcome Back',
    'auth.phone': 'Phone Number',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.register_title': 'Create Account',
    'auth.no_account': 'Don\'t have an account?',
    'auth.have_account': 'Already have an account?',
};

const ar = {
    // Common
    'common.loading': 'جاري التحميل...',
    'common.error': 'حدث خطأ',
    'common.retry': 'إعادة المحاولة',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
    'common.logout': 'تسجيل الخروج',
    'common.search': 'بحث...',

    // Navigation
    'nav.home': 'الرئيسية',
    'nav.services': 'خدماتنا',
    'nav.about': 'من نحن',
    'nav.contact': 'اتصل بنا',
    'nav.login': 'تسجيل الدخول',
    'nav.register': 'حساب جديد',
    'nav.dashboard': 'لوحة التحكم',

    // Hero
    'hero.title': 'عناية فائقة لسيارات الهايبرد والكهرباء',
    'hero.subtitle': 'تشخيص وصيانة بمستوى الوكالة مع أسعار شفافة وثقة لا تضاهى.',
    'hero.book_now': 'احجز الآن',
    'hero.view_services': 'عرض الخدمات',

    // Services
    'services.title': 'خدماتنا',
    'services.duration': '{min} دقيقة',
    'services.price': 'يبدأ من {price} د.أ',
    'services.book': 'احجز الخدمة',

    // Booking
    'booking.step1': 'اختر الخدمة',
    'booking.step2': 'اختر الموعد',
    'booking.step3': 'تأكيد الحجز',
    'booking.date': 'التاريخ',
    'booking.time': 'الوقت',
    'booking.notes': 'ملاحظات إضافية',
    'booking.submit': 'تأكيد الحجز',

    // Auth
    'auth.login_title': 'مرحباً بعودتك',
    'auth.phone': 'رقم الهاتف',
    'auth.password': 'كلمة المرور',
    'auth.fullName': 'الاسم الكامل',
    'auth.register_title': 'إنشاء حساب جديد',
    'auth.no_account': 'لا تملك حساباً؟',
    'auth.have_account': 'لديك حساب بالفعل؟',
};

const dictionaries = { en, ar };

export function t(key, params = {}) {
    const lang = store.state.lang;
    const dict = dictionaries[lang] || dictionaries['en'];
    let text = dict[key] || key;

    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}
