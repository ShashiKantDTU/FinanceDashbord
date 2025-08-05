// Internationalization utility for Site Haazri
// Supporting English and Hindi for Indian market

export const languages = {
  en: 'English',
  hi: 'हिंदी'
};

export const translations = {
  en: {
    // Navigation
    home: 'Home',
    features: 'Features',
    pricing: 'Pricing',
    blog: 'Blog',
    contact: 'Contact',

    // Hero Section
    heroTitle: 'Site Haazri: Digital Labour Management for Construction Sites',
    heroSubtitle: 'The Complete Attendance & Payment Solution for Indian Contractors',
    heroDescription: 'Transform your construction site management with Site Haazri. Track daily labour attendance, calculate overtime automatically, manage advances (peshgi), and generate accurate payment slips. Built specifically for Indian thekedars and site supervisors.',

    // Features
    easyAttendance: 'Easy Labour Attendance Tracking',
    easyAttendanceDesc: 'Replace paper registers with digital haazri. Mark attendance, overtime, and half-days instantly.',
    automatedPayments: 'Automated Payment Calculations',
    automatedPaymentsDesc: 'Auto-calculate daily wages, overtime, advances, and generate final payment slips without errors.',
    securityModel: 'Supervisor-Contractor Security Model',
    securityModelDesc: 'Tamper-proof system where supervisors mark attendance and contractors approve payments.',

    // Common Terms
    downloadApp: 'Download App',
    watchDemo: 'Watch Demo',
    getStarted: 'Get Started',
    learnMore: 'Learn More',

    // Problems & Solutions
    labourAccountProblem: 'Labour ka hisaab kaise kare?',
    labourAccountSolution: 'Site Haazri automatically calculates all labour accounts including daily wages, overtime, advances, and final settlements. No more manual calculations.',
    dailyHaazriProblem: 'Daily haazri kaise banaye?',
    dailyHaazriSolution: 'Create digital attendance registers in seconds. Mark present, absent, half-day, and overtime with just a few taps.',
    peshgiRecordProblem: 'Peshgi ka record kaise rakhe?',
    peshgiRecordSolution: 'Track all advance payments digitally. Automatic deduction from final payments with complete transparency.'
  },

  hi: {
    // Navigation
    home: 'होम',
    features: 'फीचर्स',
    pricing: 'प्राइसिंग',
    blog: 'ब्लॉग',
    contact: 'संपर्क',

    // Hero Section
    heroTitle: 'साइट हाज़री: निर्माण साइटों के लिए डिजिटल लेबर मैनेजमेंट',
    heroSubtitle: 'भारतीय ठेकेदारों के लिए संपूर्ण हाजिरी और भुगतान समाधान',
    heroDescription: 'साइट हाज़री के साथ अपने निर्माण साइट प्रबंधन को बदलें। दैनिक मजदूर हाजिरी ट्रैक करें, ओवरटाइम की गणना स्वचालित रूप से करें, एडवांस (पेशगी) का प्रबंधन करें, और सटीक भुगतान स्लिप जेनरेट करें। विशेष रूप से भारतीय ठेकेदारों और साइट सुपरवाइजर के लिए बनाया गया।',

    // Features
    easyAttendance: 'आसान मजदूर हाजिरी ट्रैकिंग',
    easyAttendanceDesc: 'कागजी रजिस्टर को डिजिटल हाज़री से बदलें। हाजिरी, ओवरटाइम, और हाफ-डे तुरंत मार्क करें।',
    automatedPayments: 'स्वचालित भुगतान गणना',
    automatedPaymentsDesc: 'दैनिक मजदूरी, ओवरटाइम, एडवांस की स्वचालित गणना करें और बिना त्रुटि के अंतिम भुगतान स्लिप जेनरेट करें।',
    securityModel: 'सुपरवाइजर-ठेकेदार सुरक्षा मॉडल',
    securityModelDesc: 'छेड़छाड़-रोधी सिस्टम जहां सुपरवाइजर हाजिरी मार्क करते हैं और ठेकेदार भुगतान अप्रूव करते हैं।',

    // Common Terms
    downloadApp: 'ऐप डाउनलोड करें',
    watchDemo: 'डेमो देखें',
    getStarted: 'शुरू करें',
    learnMore: 'और जानें',

    // Problems & Solutions
    labourAccountProblem: 'मजदूरों का हिसाब कैसे करें?',
    labourAccountSolution: 'साइट हाज़री स्वचालित रूप से सभी मजदूर खातों की गणना करता है जिसमें दैनिक मजदूरी, ओवरटाइम, एडवांस, और अंतिम निपटान शामिल है। अब कोई मैन्युअल गणना नहीं।',
    dailyHaazriProblem: 'दैनिक हाज़री कैसे बनाएं?',
    dailyHaazriSolution: 'सेकंडों में डिजिटल हाजिरी रजिस्टर बनाएं। कुछ ही टैप में उपस्थित, अनुपस्थित, हाफ-डे, और ओवरटाइम मार्क करें।',
    peshgiRecordProblem: 'पेशगी का रिकॉर्ड कैसे रखें?',
    peshgiRecordSolution: 'सभी एडवांस भुगतानों को डिजिटल रूप से ट्रैक करें। पूर्ण पारदर्शिता के साथ अंतिम भुगतान से स्वचालित कटौती।'
  }
};

export const getTranslation = (key, language = 'en') => {
  return translations[language]?.[key] || translations.en[key] || key;
};

export const getCurrentLanguage = () => {
  return localStorage.getItem('sitehaazri_language') || 'en';
};

export const setLanguage = (language) => {
  localStorage.setItem('sitehaazri_language', language);
  // Trigger a custom event to notify components of language change
  window.dispatchEvent(new CustomEvent('languageChange', { detail: language }));
};