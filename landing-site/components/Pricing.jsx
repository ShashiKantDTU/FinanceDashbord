export default function Pricing() {
  const plans = [
    {
      name: "Site Haazri Basic",
      price: "₹0",
      period: "month",
      subtext: "Free Demo ke liye",
      description: "Perfect for trying out the app",
      features: [
        "Supervisor aur Contractor dono ka login",
        "Attendance aur payment record dekhne ka mauka"
      ],
      cta: "Start Free Demo",
      popular: false,
      icon: "🆓",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200"
    },
    {
      name: "Site Haazri Pro",
      price: "₹299",
      period: "month",
      subtext: "per site",
      description: "Complete site management solution",
      features: [
        "Full access: Attendance, Labour Register, Monthly Reports",
        "Supervisor input + Contractor review",
        "Export PDF reports",
        "Safe & secure cloud backup",
        "Full support"
      ],
      cta: "Choose Pro Plan",
      popular: true,
      badge: "Special Launch Price",
      icon: "🚀",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    }
  ];

  const valuePoints = [
    {
      icon: "☕",
      text: "Ek site ka hisaab sirf ₹10 din ka – chai se bhi sasta!",
      highlight: "₹10/day"
    },
    {
      icon: "⏰",
      text: "Ek baar report banane mein lagta hai 3 ghante – yeh app har mahine wohi kaam 1 click mein kar deta hai.",
      highlight: "Save 3 hours"
    },
    {
      icon: "🛡️",
      text: "Manual galti se jo nuksaaan hota tha, woh ab band.",
      highlight: "Zero errors"
    }
  ];

  return (
    <section className="py-20 bg-white relative">
      {/* Simple Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-40 left-20 w-48 h-48 bg-orange-50 rounded-full opacity-50"></div>
        <div className="absolute bottom-40 right-20 w-48 h-48 bg-blue-50 rounded-full opacity-50"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Simple Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold mb-6">
            💰 Simple Pricing
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Aapke site ke liye, seedha aur simple plan
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Na koi hidden charge, na confusing plans – bas ek phone mein poora site ka hisaab.
          </p>
        </div>
        
        {/* Clean Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-white rounded-2xl shadow-lg p-8 border-2 transition-all duration-300 hover:shadow-xl ${
                plan.popular ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200 hover:border-blue-200'
              }`}
            >
              {/* Popular Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    {plan.badge}
                  </span>
                </div>
              )}
              
              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className="text-3xl mb-3">{plan.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                
                {/* Price Display */}
                <div className="mb-3">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-1">/ {plan.period}</span>
                </div>
                <p className="text-gray-500 text-sm">{plan.subtext}</p>
              </div>
              
              {/* Features List */}
              <div className="mb-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start text-sm">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-gray-700 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* CTA Button */}
              <button 
                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-100 text-gray-900 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Simple Value Points */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              💡 Why Site Haazri Makes Sense
            </h3>
            <p className="text-gray-600">Real savings for your business</p>
          </div>
          
          <div className="space-y-4 max-w-3xl mx-auto">
            {valuePoints.map((point, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-start">
                  <div className="text-2xl mr-4 flex-shrink-0">{point.icon}</div>
                  <div className="flex-1">
                    <div className="mb-2">
                      <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {point.highlight}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{point.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Simple Trust Statement */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-10 text-center">
          <div className="text-2xl mb-3">🛡️</div>
          <p className="text-lg font-bold text-gray-900 mb-1">
            Koi credit card nahi chahiye
          </p>
          <p className="text-blue-700 font-medium">
            Pehle demo try karo, phir decide karo
          </p>
        </div>

        {/* Clear CTA Section */}
        <div className="text-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Ready to get started?
            </h3>
            <p className="text-gray-600">Choose your plan and start today</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            {/* Primary CTA */}
            <button className="bg-orange-600 text-white px-10 py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors shadow-lg">
              <span className="flex items-center justify-center">
                <span className="mr-2">🚀</span>
                Start Your Free Demo
              </span>
            </button>
            
            {/* Secondary CTA */}
            <button className="border-2 border-gray-300 text-gray-700 px-10 py-3 rounded-xl font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300">
              <span className="flex items-center justify-center">
                <span className="mr-2">💬</span>
                Talk to Support
              </span>
            </button>
          </div>

          {/* Simple Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="text-green-500 mr-1">✅</span>
              No setup fees
            </div>
            <div className="flex items-center">
              <span className="text-blue-500 mr-1">🔒</span>
              Secure payments
            </div>
            <div className="flex items-center">
              <span className="text-purple-500 mr-1">📞</span>
              24/7 support
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}