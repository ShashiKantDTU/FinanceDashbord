import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Pricing from '../components/Pricing';

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>Site Haazri Pricing - ₹299/Month Construction Site Management App | Simple Plans for Contractors</title>
        <meta name="description" content="Site Haazri pricing: Free demo available, Pro plan at ₹299/month per site. No hidden charges, no setup fees. Perfect for Indian contractors. Start free trial today!" />
        <meta name="keywords" content="site haazri pricing, construction app price, contractor app cost, site management app pricing India, ₹299 per month, free demo, no hidden charges" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Site Haazri Pricing - ₹299/Month for Complete Site Management" />
        <meta property="og:description" content="Simple pricing for contractors: Free demo + Pro plan ₹299/month per site. No hidden charges, no setup fees. Start free trial today!" />
        <meta property="og:image" content="https://sitehaazri.com/images/pricing-og.jpg" />
        <meta property="og:url" content="https://sitehaazri.com/pricing" />
        <meta property="og:type" content="website" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Site Haazri Pricing - ₹299/Month Construction Site Management" />
        <meta name="twitter:description" content="Simple pricing for contractors: Free demo + Pro plan ₹299/month. No hidden charges!" />
        <meta name="twitter:image" content="https://sitehaazri.com/images/pricing-twitter.jpg" />
        
        <link rel="canonical" href="https://sitehaazri.com/pricing" />
        
        {/* Structured Data for Pricing */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Site Haazri",
              "description": "Construction site management app for contractors and supervisors",
              "brand": {
                "@type": "Brand",
                "name": "Site Haazri"
              },
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Site Haazri Basic",
                  "description": "Free demo version for trying out the app",
                  "price": "0",
                  "priceCurrency": "INR",
                  "availability": "https://schema.org/InStock",
                  "validFrom": "2024-01-01",
                  "priceValidUntil": "2025-12-31",
                  "itemCondition": "https://schema.org/NewCondition"
                },
                {
                  "@type": "Offer",
                  "name": "Site Haazri Pro",
                  "description": "Complete site management solution per site per month",
                  "price": "299",
                  "priceCurrency": "INR",
                  "availability": "https://schema.org/InStock",
                  "validFrom": "2024-01-01",
                  "priceValidUntil": "2025-12-31",
                  "itemCondition": "https://schema.org/NewCondition",
                  "billingIncrement": "P1M"
                }
              ]
            })
          }}
        />
      </Head>

      <Header />
      
      <main>
        <section className="py-20 bg-gradient-to-r from-orange-600 to-red-600 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Site Haazri Pricing - Seedha aur Simple Plan
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Na koi hidden charge, na confusing plans. Sirf ₹299/month per site - chai se bhi sasta daily cost!
            </p>
          </div>
        </section>
        
        <Pricing />
        
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Pricing ke baare mein Common Questions
            </h2>
            
            <div className="space-y-8 text-left">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  ❓ Site Haazri ka actual cost kya hai?
                </h3>
                <p className="text-gray-600">
                  Site Haazri Pro sirf ₹299 per month per site hai. Matlab ek site ka daily cost sirf ₹10 - chai se bhi sasta! 
                  Free demo bhi available hai try karne ke liye.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  ❓ Kya koi hidden charges hain?
                </h3>
                <p className="text-gray-600">
                  Bilkul nahi! Jo price bataya hai wohi final hai. No setup fees, no hidden charges, no extra costs. 
                  Bas ₹299/month per site - that's it!
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  ❓ Payment kaise kar sakte hain?
                </h3>
                <p className="text-gray-600">
                  UPI, Net Banking, Credit Card, Debit Card - sab payment methods accept karte hain. 
                  Monthly payment kar sakte hain, koi long-term commitment nahi hai.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  ❓ Multiple sites ke liye discount milta hai?
                </h3>
                <p className="text-gray-600">
                  Haan! 5+ sites ke liye special discount available hai. Contact karo humse - 
                  bulk pricing discuss kar sakte hain.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  ❓ Free demo mein kya-kya mil jata hai?
                </h3>
                <p className="text-gray-600">
                  Free demo mein supervisor aur contractor dono ka login milta hai. Attendance mark kar sakte hain, 
                  basic reports dekh sakte hain. Koi time limit nahi hai demo ke liye.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </>
  );
}