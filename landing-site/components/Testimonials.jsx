export default function Testimonials() {
  const testimonials = [
    {
      name: "Shyam Lal",
      location: "Bhopal",
      tag: "20+ labours",
      quote: "Pehle har mahine 2-3 din lagta tha attendance jodne mein. Ab sirf 5 minute mein sab ready ho jata hai. Supervisor bhi khush hai kyunki usse phone par kaam karne ko milta hai.",
      avatar: "👨‍💼",
      rating: 5,
      highlight: "Saved 2-3 days monthly",
      category: "Time Saver",
      gradient: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-200"
    },
    {
      name: "Rajesh Kumar",
      location: "Delhi",
      tag: "15+ labours",
      quote: "Manual register mein hamesha galti ho jati thi. Ab data bilkul accurate hai aur payment calculation automatic hai. Time aur paisa dono bach gaya.",
      avatar: "👨‍🔧",
      rating: 5,
      highlight: "100% Accurate Data",
      category: "Accuracy Expert",
      gradient: "from-green-50 to-emerald-50",
      borderColor: "border-green-200"
    },
    {
      name: "Mukesh Singh",
      location: "Pune",
      tag: "30+ labours",
      quote: "Supervisor ko training dene ki zarurat nahi padi. App itna simple hai ki 2 din mein sab samajh gaya. Ab site ka kaam smooth chal raha hai.",
      avatar: "👨‍🏭",
      rating: 5,
      highlight: "No Training Needed",
      category: "Ease of Use",
      gradient: "from-purple-50 to-indigo-50",
      borderColor: "border-purple-200"
    },
    {
      name: "Dinesh Sharma",
      location: "Jaipur",
      tag: "25+ labours",
      quote: "Data safe rahta hai cloud mein, kabhi gum nahi hota. Monthly reports PDF mein mil jati hain. Clients ko dikhane mein bhi professional lagta hai.",
      avatar: "👨‍💻",
      rating: 5,
      highlight: "Professional Reports",
      category: "Data Security",
      gradient: "from-orange-50 to-yellow-50",
      borderColor: "border-orange-200"
    }
  ];

  const trustBadges = [
    { 
      icon: "✅", 
      text: "Verified by 100+ Contractors",
      subtext: "Real contractors, real results",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    { 
      icon: "⭐", 
      text: "4.8★ Rating by Real Users",
      subtext: "Consistently high ratings",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    { 
      icon: "🛡️", 
      text: "Data Secure & Transparent",
      subtext: "Bank-level security standards",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    { 
      icon: "🇮🇳", 
      text: "Made in India, for Indian Sites",
      subtext: "Built for Indian contractors",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50 relative">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-32 left-20 w-64 h-64 bg-blue-100 rounded-full opacity-30 blur-3xl"></div>
        <div className="absolute bottom-32 right-20 w-64 h-64 bg-green-100 rounded-full opacity-30 blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Clear Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-6">
            💬 Real User Reviews
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Contractor log kya bol rahe hain<br />
            <span className="text-blue-600">Site Haazri ke baare mein?</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Real logon ke real experience – app par bharosa kyun karna chahiye?
          </p>
        </div>

        {/* Clean Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-2">
              {/* Simple Quote Mark */}
              <div className="absolute top-4 right-4 text-3xl text-gray-200">"</div>
              
              {/* User Info */}
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-xl">{testimonial.avatar}</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {testimonial.name}
                  </h3>
                  <p className="text-gray-600 text-sm">{testimonial.location}</p>
                  <p className="text-gray-500 text-xs">{testimonial.tag}</p>
                </div>
              </div>

              {/* Star Rating */}
              <div className="flex items-center mb-3">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">⭐</span>
                  ))}
                </div>
                <span className="ml-2 text-sm text-gray-600 font-medium">5.0</span>
              </div>

              {/* Key Benefit */}
              <div className="mb-4">
                <span className="inline-block bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold border border-green-200">
                  ✅ {testimonial.highlight}
                </span>
              </div>
              
              {/* Testimonial Quote */}
              <p className="text-gray-700 leading-relaxed text-sm mb-4">
                "{testimonial.quote}"
              </p>

              {/* Verification */}
              <div className="flex items-center text-xs text-blue-600 font-medium">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Verified Contractor
              </div>
            </div>
          ))}
        </div>

        {/* Trust Elements Banner */}
        <div className="mb-16">
          <div className="bg-gray-50 rounded-2xl p-10 border border-gray-200">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                🏆 Trusted by Contractors Across India
              </h3>
              <p className="text-gray-600">Join 100+ contractors who chose Site Haazri</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {trustBadges.map((badge, index) => (
                <div key={index} className="text-center">
                  <div className={`w-16 h-16 ${badge.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm`}>
                    <span className={`text-2xl ${badge.color}`}>{badge.icon}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-base mb-2">
                    {badge.text}
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {badge.subtext}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clear Final CTA */}
        <div className="text-center">
          <div className="mb-10">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              Aap bhi try karo –<br />
              <span className="text-blue-600">bina cost ke shuru karo</span>
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join 100+ contractors who transformed their site management
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            {/* Primary CTA */}
            <button className="bg-orange-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-orange-700 transition-colors text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              <span className="flex items-center justify-center">
                <span className="mr-2">🚀</span>
                Start Your Free Demo
              </span>
            </button>

            {/* Secondary CTA */}
            <button className="border-2 border-gray-300 text-gray-700 px-10 py-4 rounded-xl font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 text-lg">
              <span className="flex items-center justify-center">
                <span className="mr-2">👁️</span>
                See Supervisor Login
              </span>
            </button>
          </div>

          {/* Simple Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="text-green-500 mr-1">✅</span>
              No credit card required
            </div>
            <div className="flex items-center">
              <span className="text-blue-500 mr-1">⚡</span>
              Setup in 2 minutes
            </div>
            <div className="flex items-center">
              <span className="text-purple-500 mr-1">🎯</span>
              Real site demo
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}