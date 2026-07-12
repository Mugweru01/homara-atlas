# Homara Atlas

![Homara Atlas Banner](https://via.placeholder.com/1200x400/16a34a/ffffff?text=Homara+Atlas+-+Property+Intelligence)

Homara Atlas is a world-class Property Intelligence Platform designed to transform large volumes of public, economic, and geographic data into actionable market intelligence. It acts as the definitive source of truth for the African real estate market.

---

## 🏗️ Architecture

Atlas is built with a modern, decoupled architecture designed for scalability, security, and rapid analytics.

- **Frontend (Web)**: React 18, Vite, Tailwind CSS, Recharts, and Shadcn UI. A beautiful, glassmorphic dashboard for visualizing market trends.
- **Backend (API)**: FastAPI (Python). High-performance REST API with automatic Swagger documentation.
- **Database**: PostgreSQL. A robust relational database for the data warehouse, isolated from any operational Homara platforms.
- **Infrastructure**: AWS (EC2 & RDS). Provisioned entirely via Terraform.
- **Deployment**: Dockerized services orchestrated with Docker Compose, deployed via GitHub Actions CI/CD.

---

## 🌟 Core Features

- **Property & Rental Price Index**: Standardized metrics tracking market health across major counties.
- **Neighbourhood Intelligence**: Deep dives into local supply, demand, and safety/growth metrics.
- **Housing Affordability Index**: Analysis correlating median income data with housing costs (the 30% rule).
- **Interactive Heat Maps**: Geospatial visualization of property values and growth areas.
- **Developer API**: A public REST API for third-party developers to build on top of Atlas data.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Docker and Docker Compose
- Node.js (v18+)
- Python 3.10+

### 1. Database Setup
You can run the PostgreSQL database locally using Docker:
```bash
docker-compose -f docker-compose.prod.yml up -d db
```
*(Alternatively, rely on the local `app.db` SQLite fallback for rapid API testing).*

### 2. Backend (FastAPI)
Navigate to the API directory, install dependencies, and start the server:
```bash
cd api
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
The API will be available at `http://localhost:8000`.
View the Swagger documentation at `http://localhost:8000/docs`.

### 3. Frontend (React/Vite)
Navigate to the web directory, install dependencies, and start the development server:
```bash
cd apps/web
npm install
npm run dev
```
The frontend will be available at `http://localhost:5173`.

---

## ☁️ Infrastructure & Deployment

The infrastructure is provisioned on the **AWS Free Tier** using Terraform.

### Terraform Configuration
Located in `/infrastructure/aws-free-tier.tf`:
- **EC2 Instance**: `t3.micro` running Ubuntu 22.04.
- **RDS Instance**: `db.t4g.micro` running PostgreSQL 15.
- **Security Groups**: SSH (22), HTTP (80), Custom TCP (8000, 5173), and PostgreSQL (5432).

### CI/CD Pipeline
A GitHub Actions workflow (`.github/workflows/deploy.yml`) handles continuous deployment.
On every push to `main` (or manual dispatch):
1. Docker images are built and pushed to Docker Hub.
2. The EC2 instance is accessed via SSH.
3. The latest code and Docker images are pulled.
4. Services are restarted using `docker-compose.prod.yml`.

To deploy manually, navigate to the **Actions** tab in GitHub, select **Deploy to AWS EC2 (Free Tier)**, and click **Run workflow**.

---

## 🔒 Security Principles
- **No PII**: Atlas never stores customer, payment, or employee data.
- **Read-Only**: Any proprietary data consumed is through strictly documented, aggregated, and anonymized exports.
- **Zero Trust**: Strict isolation from operational databases.

---

## 📄 License
Copyright © Homara. All rights reserved.
