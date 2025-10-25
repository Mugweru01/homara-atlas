const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-6">
            <img src="/placeholder.svg" alt="Homara Logo" className="h-16 w-16" />
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Welcome to Homara
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your trusted platform for property listings and landlord verification
          </p>

          <div className="flex gap-4 justify-center pt-8">
            <a href="/admin/login">
              <button className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg">
                Admin Login
              </button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
