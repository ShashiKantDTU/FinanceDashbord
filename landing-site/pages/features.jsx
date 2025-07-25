import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Features from '../components/Features';

export default function FeaturesPage() {
  return (
    <>
      <Head>
        <title>Site Haazri Features - Construction Site Management App Features | Attendance, Reports & More</title>
        <meta name="description" content="Explore Site Haazri's powerful features: Daily attendance tracking, supervisor access control, monthly reports, payment calculator, secure data storage & multi-site management for contractors." />
        <meta name="keywords" content="site haazri features, construction app features, attendance tracking features, site management tools, contractor app capabilities, supervisor access control, monthly reports generation" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Site Haazri Features - Complete Construction Site Management Tools" />
        <meta property="og:description" content="Discover all powerful features: attendance tracking, report generation, payment calculations, secure data storage & more. Perfect for Indian contractors & supervisors." />
        <meta property="og:image" content="https://sitehaazri.com/images/features-og.jpg" />
        <meta property="og:url" content="https://sitehaazri.com/features" />
        <meta property="og:type" content="website" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Site Haazri Features - Construction Site Management Tools" />
        <meta name="twitter:description" content="Explore powerful features for construction site management: attendance, reports, payments & more." />
        <meta name="twitter:image" content="https://sitehaazri.com/images/features-twitter.jpg" />
        
        <link rel="canonical" href="https://sitehaazri.com/features" />
        
        {/* Structured Data for Features */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Site Haazri Features",
              "description": "Complete list of Site Haazri construction site management app features",
              "url": "https://sitehaazri.com/features",
              "mainEntity": {
                "@type": "SoftwareApplication",
                "name": "Site Haazri",
                "featureList": [
                  "Daily Attendance Marking - Manual register ka jhanjhat khatam",
                  "Supervisor Access Control - Limited access with security",
                  "Monthly Report Generation - Automatic PDF reports",
                  "Labour Payment Calculator - Automatic payment calculations",
                  "Data History & Backup - Cloud storage for records",
                  "Export & Share Reports - PDF download and WhatsApp sharing",
                  "Secure Data Storage - Bank-level security",
                  "Multi-Site Management - Multiple sites in one account"
                ]
              }
            })
          }}
        />
      </Head>

      <Header />
      
      <main>
        <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Site Haazri Features - Contractor ka Digital Toolkit
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Attendance se lekar monthly report tak, har kaam ek hi jagah pe. Sab features jo aapke site management ke liye chahiye.
            </p>
          </div>
        </section>
        
        <Features />
        
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Why Contractors Choose Site Haazri?
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Sirf attendance app nahi hai – ye ek complete site management solution hai jo aapke har kaam ko easy banata hai.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  🔒 Security & Data Protection
                </h3>
                <p className="text-gray-600 mb-6">
                  Aapka data bank-level security ke saath protect kiya jata hai. Supervisor sirf data add kar sakta hai, 
                  edit ya delete nahi kar sakta. Har entry secure aur traceable hoti hai.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">Bank-level encryption for all data</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">Restricted supervisor access - no edit/delete</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">Automatic cloud backup - data kabhi lost nahi hota</span>
                  </li>
                  <li className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">Complete audit trail for all entries</span>
                  </li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-8 border border-blue-200">
                <div className="text-center">
                  <div className="text-6xl mb-4">🛡️</div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">Data Security Guarantee</h4>
                  <p className="text-gray-600 mb-4">
                    "Supervisor data sirf add kar sakta hai, delete/edit ka option nahi hota – taaki record safe rahe."
                  </p>
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span>✅ Add Entry</span>
                        <span className="text-green-600 font-semibold">Allowed</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span>❌ Edit Entry</span>
                        <span className="text-red-600 font-semibold">Blocked</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>❌ Delete Entry</span>
                        <span className="text-red-600 font-semibold">Blocked</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </>
  );
}