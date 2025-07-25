import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DemoSection from '../components/DemoSection';

export default function DemoPage() {
  return (
    <>
      <Head>
        <title>Site Haazri Demo - Free Live Demo of Construction Site Management App | Try Now</title>
        <meta name="description" content="Watch Site Haazri live demo - see how contractors track attendance, generate reports & calculate payments. Free demo available in Hindi. No registration required!" />
        <meta name="keywords" content="site haazri demo, construction app demo, free demo, live demo, site management demo, contractor app trial, attendance app demo, hindi demo" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Site Haazri Demo - Free Live Demo of Construction Site Management App" />
        <meta property="og:description" content="Watch Site Haazri live demo - see attendance tracking, report generation & payment calculations in action. Free demo in Hindi!" />
        <meta property="og:image" content="https://sitehaazri.com/images/demo-og.jpg" />
        <meta property="og:url" content="https://sitehaazri.com/demo" />
        <meta property="og:type" content="website" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Site Haazri Demo - Free Construction App Demo" />
        <meta name="twitter:description" content="Watch live demo of Site Haazri construction site management app. Free demo in Hindi!" />
        <meta name="twitter:image" content="https://sitehaazri.com/images/demo-twitter.jpg" />
        
        <link rel="canonical" href="https://sitehaazri.com/demo" />
        
        {/* Structured Data for Demo */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": "Site Haazri Demo Video",
              "description": "Live demo of Site Haazri construction site management app showing attendance tracking, report generation, and payment calculations",
              "thumbnailUrl": "https://sitehaazri.com/images/demo-thumbnail.jpg",
              "uploadDate": "2024-01-01",
              "duration": "PT3M30S",
              "contentUrl": "https://sitehaazri.com/demo-video",
              "embedUrl": "https://sitehaazri.com/demo",
              "inLanguage": "hi-IN",
              "publisher": {
                "@type": "Organization",
                "name": "Site Haazri",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://sitehaazri.com/images/logo.png"
                }
              }
            })
          }}
        />
      </Head>

      <Header />
      
      <main>
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Site Haazri Live Demo - Dekho Kaise Kaam Karta Hai
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              3 minute ka demo video dekho - attendance tracking, report generation, aur payment calculations ka live example. 
              Hindi mein samjhaya gaya hai, bilkul free!
            </p>
          </div>
        </section>
        
        <DemoSection />
        
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Demo Mein Ye Sab Features Dekhoge
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Live demo mein ye sab features ka actual working dekh sakte ho - real site ka example use kiya gaya hai.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">2 Minute Setup</h3>
                <p className="text-gray-600">Dekho kaise 2 minute mein app setup ho jata hai - koi technical knowledge nahi chahiye.</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Attendance Marking</h3>
                <p className="text-gray-600">Live dekho kaise supervisor phone se attendance mark karta hai - real-time sync hota hai.</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Report Generation</h3>
                <p className="text-gray-600">1 click mein monthly report kaise generate hoti hai - PDF download bhi kar sakte ho.</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Calculator</h3>
                <p className="text-gray-600">Automatic payment calculation dekho - attendance ke basis par kitna paisa dena hai.</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Security Features</h3>
                <p className="text-gray-600">Dekho kaise supervisor sirf data add kar sakta hai - edit/delete ka option nahi hai.</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📤</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Export & Share</h3>
                <p className="text-gray-600">Reports ko PDF mein download karo ya WhatsApp se share karo - bilkul simple.</p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <div className="bg-blue-50 rounded-2xl p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  🎯 Demo Dekhne ke Baad
                </h3>
                <p className="text-gray-700 mb-6">
                  Demo dekh kar samajh jaoge ki Site Haazri kaise aapke site management ko easy banata hai. 
                  Koi questions hain toh direct call kar sakte ho - Hindi support available hai!
                </p>
                <button className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-700 transition-colors">
                  📞 Demo ke Baad Call Karein
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </>
  );
}