// Google Analytics and tracking utilities for Site Haazri Web App Dashboard

// Google Analytics 4 Configuration for Web App
export const GA_TRACKING_ID = 'G-XXXXXXXXXX'; // TODO: Replace with your actual GA4 tracking ID for app.sitehaazri.in

// Initialize Google Analytics
export const initGA = () => {
  // Load Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  
  gtag('js', new Date());
  gtag('config', GA_TRACKING_ID, {
    page_title: document.title,
    page_location: window.location.href,
  });
};

// Track page views
export const trackPageView = (url, title) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_TRACKING_ID, {
      page_title: title,
      page_location: url,
    });
  }
};

// Track custom events for SEO insights
export const trackEvent = (action, category, label, value) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Web App specific event tracking
export const trackWebAppEvents = {
  // Track user interactions within the dashboard
  siteCreated: (siteName) => {
    trackEvent('create', 'Site Management', siteName);
  },
  
  attendanceMarked: (siteId, employeeCount) => {
    trackEvent('mark_attendance', 'Attendance', siteId, employeeCount);
  },
  
  reportGenerated: (reportType, siteId) => {
    trackEvent('generate_report', 'Reports', `${reportType}_${siteId}`);
  },
  
  paymentCalculated: (siteId, amount) => {
    trackEvent('calculate_payment', 'Payments', siteId, amount);
  },
  
  dashboardView: (pageType) => {
    trackEvent('view', 'Dashboard', pageType);
  },
  
  languageSwitch: (fromLang, toLang) => {
    trackEvent('language_switch', 'Localization', `${fromLang}_to_${toLang}`);
  },
  
  userLogin: (method) => {
    trackEvent('login', 'Authentication', method);
  },
  
  userLogout: () => {
    trackEvent('logout', 'Authentication', 'manual');
  },
  
  settingsUpdated: (settingType) => {
    trackEvent('update', 'Settings', settingType);
  },
  
  exportData: (dataType, format) => {
    trackEvent('export', 'Data Export', `${dataType}_${format}`);
  }
};

// Schema.org structured data helpers
export const generateBreadcrumbSchema = (breadcrumbs) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
};

export const generateFAQSchema = (faqs) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

export const generateArticleSchema = (article) => {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "author": {
      "@type": "Organization",
      "name": "Site Haazri"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Site Haazri",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.sitehaazri.com/logo.png"
      }
    },
    "datePublished": article.publishDate,
    "dateModified": article.modifiedDate,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url
    }
  };
};

// Performance tracking for Core Web Vitals
export const trackWebVitals = () => {
  if ('web-vital' in window) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => trackEvent('Web Vitals', 'CLS', metric.name, Math.round(metric.value * 1000)));
      getFID((metric) => trackEvent('Web Vitals', 'FID', metric.name, Math.round(metric.value)));
      getFCP((metric) => trackEvent('Web Vitals', 'FCP', metric.name, Math.round(metric.value)));
      getLCP((metric) => trackEvent('Web Vitals', 'LCP', metric.name, Math.round(metric.value)));
      getTTFB((metric) => trackEvent('Web Vitals', 'TTFB', metric.name, Math.round(metric.value)));
    });
  }
};