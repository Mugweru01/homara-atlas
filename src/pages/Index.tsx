const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Animated Background Gradient Mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary-50/20 to-background">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-glow/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-info/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
      </div>

      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      ></div>

      {/* Content Container */}
      <div className="relative container mx-auto px-4 py-16 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-12 max-w-4xl animate-fade-up">
          {/* Logo with Glow Effect */}
          <div className="relative inline-flex items-center justify-center mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow opacity-20 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative p-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl rounded-3xl shadow-glow border border-primary/20">
              <img 
                src="/placeholder.svg" 
                alt="Homara Logo" 
                className="h-24 w-24 animate-bounce-subtle" 
              />
            </div>
          </div>
          
          {/* Hero Title with Gradient */}
          <div className="space-y-4">
            <h1 className="text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="inline-block bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent animate-gradient">
                Welcome to Homara
              </span>
            </h1>
            
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"></div>
          </div>
          
          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
            Your trusted platform for property listings and landlord verification
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            {[
              { icon: "🏠", title: "Property Listings", desc: "Manage properties with ease" },
              { icon: "✓", title: "Verification", desc: "Trusted landlord checks" },
              { icon: "👥", title: "User Management", desc: "Complete admin control" },
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="group p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-300 hover:scale-105 cursor-default"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex gap-4 justify-center pt-12">
            <a href="/admin/login" className="group relative inline-block">
              {/* Glow effect on hover */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-glow rounded-xl blur-lg opacity-30 group-hover:opacity-70 transition-all duration-300 animate-pulse-glow"></div>
              
              {/* Button */}
              <button className="relative px-10 py-4 bg-gradient-to-r from-primary to-primary-600 text-primary-foreground rounded-xl font-semibold text-lg shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-3">
                <span>Access Admin Panel</span>
                <svg 
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </a>
          </div>

          {/* Subtle Footer Text */}
          <p className="text-sm text-muted-foreground/60 pt-8">
            Secure • Reliable • Professional
          </p>
        </div>
      </div>

      {/* Scroll Indicator (optional) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle">
        <div className="w-6 h-10 rounded-full border-2 border-primary/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-primary/50 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default Index;
