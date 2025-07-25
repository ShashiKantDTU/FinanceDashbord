import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HeroSection from '../components/HeroSection';
import ProblemSolution from '../components/ProblemSolution';
import Features from '../components/Features';
import Testimonials from '../components/Testimonials';
import Pricing from '../components/Pricing';
import HowItWorks from '../components/HowItWorks';
import DemoSection from '../components/DemoSection';

export default function Home() {
  return (
    <>
      <Head>
        <title>Site Haazri - Construction Site Management App | Attendance & Reports for Indian Contractors</title>
        <meta name="description" content="Site Haazri is India's #1 construction site management app. Track attendance, generate reports, calculate payments digitally. Free demo for contractors & supervisors. Made in India." />
        <meta name="keywords" content="site management app, construction attendance app, contractor app India, site supervisor app, labour attendance tracker, construction project management, site haazri, digital attendance system, construction site software" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="author" content="Site Haazri" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Language" content="hi-IN, en-IN" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.country" content="India" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://sitehaazri.com/" />
        <meta property="og:title" content="Site Haazri - Construction Site Management App for Indian Contractors" />
        <meta property="og:description" content="Track attendance, generate reports & calculate payments digitally. India's most trusted construction site management app. Free demo available!" />
        <meta property="og:image" content="https://sitehaazri.com/images/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Site Haazri" />
        <meta property="og:locale" content="hi_IN" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://sitehaazri.com/" />
        <meta name="twitter:title" content="Site Haazri - Construction Site Management App for Indian Contractors" />
        <meta name="twitter:description" content="Track attendance, generate reports & calculate payments digitally. India's most trusted construction site management app. Free demo available!" />
        <meta name="twitter:image" content="https://sitehaazri.com/images/twitter-image.jpg" />
        <meta name="twitter:creator" content="@SiteHaazri" />
        
        {/* Additional SEO Meta Tags */}
        <meta name="theme-color" content="#EA580C" />
        <meta name="msapplication-TileColor" content="#EA580C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Site Haazri" />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://sitehaazri.com/" />
        
        {/* Favicons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Site Haazri",
              "url": "https://sitehaazri.com",
              "logo": "https://sitehaazri.com/images/logo.png",
              "description": "India's leading construction site management app for contractors and supervisors",
              "foundingDate": "2024",
              "foundingLocation": {
                "@type": "Place",
                "name": "India"
              },
              "areaServed": {
                "@type": "Country",
                "name": "India"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+91-XXXXXXXXXX",
                "contactType": "customer service",
                "availableLanguage": ["Hindi", "English"]
              },
              "sameAs": [
                "https://www.facebook.com/sitehaazri",
                "https://www.instagram.com/sitehaazri",
                "https://twitter.com/sitehaazri"
              ]
            })
          }}
        />
        
        {/* Structured Data - Software Application */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Site Haazri",
              "operatingSystem": "Android, iOS, Web",
              "applicationCategory": "BusinessApplication",
              "applicationSubCategory": "Construction Management",
              "description": "Construction site management app for attendance tracking, report generation, and payment calculations. Designed for Indian contractors and supervisors.",
              "url": "https://sitehaazri.com",
              "downloadUrl": "https://play.google.com/store/apps/details?id=com.sitehaazri",
              "softwareVersion": "1.0",
              "datePublished": "2024-01-01",
              "author": {
                "@type": "Organization",
                "name": "Site Haazri"
              },
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Site Haazri Basic",
                  "price": "0",
                  "priceCurrency": "INR",
                  "description": "Free demo version"
                },
                {
                  "@type": "Offer",
                  "name": "Site Haazri Pro",
                  "price": "299",
                  "priceCurrency": "INR",
                  "description": "Full featured version per site per month"
                }
              ],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "100",
                "bestRating": "5",
                "worstRating": "1"
              },
              "featureList": [
                "Daily Attendance Tracking",
                "Supervisor Access Control",
                "Monthly Report Generation",
                "Labour Payment Calculator",
                "Data History & Backup",
                "Export & Share Reports",
                "Secure Data Storage",
                "Multi-Site Management"
              ]
            })
          }}
        />
        
        {/* Structured Data - FAQ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Site Haazri kya hai?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Site Haazri ek construction site management app hai jo contractors aur supervisors ke liye banaya gaya hai. Isme attendance tracking, report generation, aur payment calculations ki facility hai."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Site Haazri ka price kya hai?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Site Haazri Basic free hai demo ke liye. Site Haazri Pro ₹299 per month per site hai jisme sab features included hain."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Kya Site Haazri secure hai?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Haan, Site Haazri bank-level security use karta hai. Supervisor sirf data add kar sakta hai, edit ya delete nahi kar sakta. Sab data encrypted aur secure hai."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Site Haazri kaise setup karte hain?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Site Haazri setup karna bahut easy hai - sirf 4 steps: 1) App install karo, 2) Supervisor ka account banao, 3) Supervisor data update karega, 4) Contractor live dekh sakta hai."
                  }
                }
              ]
            })
          }}
        />
        
        {/* Structured Data - BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://sitehaazri.com/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Features",
                  "item": "https://sitehaazri.com/features"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Pricing",
                  "item": "https://sitehaazri.com/pricing"
                },
                {
                  "@type": "ListItem",
                  "position": 4,
                  "name": "Demo",
                  "item": "https://sitehaazri.com/demo"
                }
              ]
            })
          }}
        />
        
        {/* Structured Data - Local Business (if applicable) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Site Haazri",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Android, iOS, Web",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "0",
                "highPrice": "299",
                "priceCurrency": "INR",
                "offerCount": "2"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "100",
                "bestRating": "5",
                "worstRating": "1"
              },
              "review": [
                {
                  "@type": "Review",
                  "author": {
                    "@type": "Person",
                    "name": "Shyam Lal"
                  },
                  "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                  },
                  "reviewBody": "Pehle har mahine 2-3 din lagta tha attendance jodne mein. Ab sirf 5 minute mein sab ready ho jata hai."
                },
                {
                  "@type": "Review",
                  "author": {
                    "@type": "Person",
                    "name": "Rajesh Kumar"
                  },
                  "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                  },
                  "reviewBody": "Manual register mein hamesha galti ho jati thi. Ab data bilkul accurate hai aur payment calculation automatic hai."
                }
              ]
            })
          }}
        />
      </Head>

      <Header />
      
      <main>
        <HeroSection />
        <ProblemSolution />
        <Features />
        <Testimonials />
        <Pricing />
        <HowItWorks />
        <DemoSection />
        
        <section id="cta" className="py-20 bg-orange-600 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Make Your Site Smart?
            </h2>
            <p className="text-xl text-orange-100 mb-8">
              Join 100+ contractors who trust Site Haazri for their site management.
            </p>
            <button className="bg-white text-orange-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-lg">
              📲 App Install Karein - Free Demo
            </button>
          </div>
        </section>
      </main>
      
      <Footer />
    </>
  );
}