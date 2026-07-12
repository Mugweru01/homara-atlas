# Homara Atlas Production Deployment Guide

This guide outlines how to deploy the Homara Atlas API and Web components to a production environment using Docker.

## Architecture Overview

The system consists of two primary containerized services:
1. **API**: A Python 3.11 FastAPI service handling data delivery.
2. **Web**: A Node.js/Bun-based frontend (Vite/Next.js) serving the user interface.

In production, these services should ideally be deployed behind a reverse proxy (e.g., Nginx, Traefik, or an AWS Application Load Balancer).

## Local Production Testing

To test the production builds locally using Docker Compose:

1. Build the images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. Run the services in detached mode:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. Access the web app at `http://localhost:3000` and the API at `http://localhost:8000`.

## Cloud Deployment Strategy (General / AWS)

### 1. Container Registry
Push the Docker images to a registry like AWS Elastic Container Registry (ECR) or Docker Hub.
```bash
docker build -t your-registry/homara-atlas-api:latest ./api
docker push your-registry/homara-atlas-api:latest

docker build -t your-registry/homara-atlas-web:latest ./apps/web
docker push your-registry/homara-atlas-web:latest
```

### 2. Orchestration (e.g., AWS ECS / Fargate)
- Create a Task Definition for the API and another for the Web service.
- Assign appropriate IAM roles (e.g., allowing the API to read from S3 if necessary).
- Map port 8000 (API) and 3000 (Web) to your container instances.
- Use an Application Load Balancer (ALB) to route traffic:
  - `api.yourdomain.com` -> API Target Group
  - `app.yourdomain.com` -> Web Target Group

### 3. Database Considerations
- For initial stages, the API uses a local `duckdb` file.
- **For true production**: Migrate the data pipeline to Amazon Redshift or PostgreSQL (RDS).
- Update the API environment variables (`DB_HOST`, `DB_USER`, `DB_PASS`) in your ECS Task Definition to connect to the cloud database.

### 4. CI/CD Integration
- Configure GitHub Actions to automatically trigger the `docker build` and `docker push` commands upon merges to the `main` branch.
- Add a step to force an ECS service update (`aws ecs update-service --force-new-deployment`) to deploy the latest image.
