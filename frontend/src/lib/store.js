export const store = {
  state: {
    user: null, 
    lang: 'en', // 'en' | 'ar'
    theme: 'system', // 'light' | 'dark' | 'system'
    isReady: false
  },
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  emit() {
    this.listeners.forEach(listener => listener(this.state));
  },

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.emit();
  },

  setUser(user) {
    this.setState({ user });
  },

  setLang(lang) {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('sc_lang', lang);
    this.setState({ lang });
  },

  setTheme(theme) {
    this.setState({ theme });
    localStorage.setItem('sc_theme', theme);
    this.applyTheme();
  },

  applyTheme() {
    const isDark = 
      this.state.theme === 'dark' || 
      (this.state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  init() {
    const savedLang = localStorage.getItem('sc_lang') || 'en';
    const savedTheme = localStorage.getItem('sc_theme') || 'system';
    this.setLang(savedLang);
    this.setTheme(savedTheme);
  }
};
