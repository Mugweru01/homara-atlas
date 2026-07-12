# Homara Atlas: AWS Cloud Architecture

This document maps the logical Enterprise Architecture to specific AWS managed services, optimizing for scalability, reliability, and security.

## 1. Cloud Architecture Overview

Atlas relies on a modern, serverless-first approach on AWS to keep operational overhead low while handling massive data scale.

```mermaid
graph TD
    subgraph VPC [Homara Atlas VPC]
        subgraph Public Subnet
            ALB[Application Load Balancer]
            NAT[NAT Gateway]
        end
        
        subgraph Private Subnet (Compute & App)
            EKS[EKS / ECS Fargate]
            FastAPI[FastAPI Containers]
            Airflow[MWAA - Airflow]
        end
        
        subgraph Private Subnet (Data)
            Redshift[(Redshift Serverless)]
            MSK[Amazon MSK]
            Redis[(ElastiCache Redis)]
        end
    end
    
    Internet((Internet)) --> ALB
    ALB --> FastAPI
    
    FastAPI --> MSK
    FastAPI --> Redis
    
    Airflow --> S3[(Amazon S3 Data Lake)]
    S3 --> Redshift
```

## 2. Service Mapping
- **Compute:** Amazon EKS (Elastic Kubernetes Service) or ECS Fargate for running FastAPI backends and ingestion workers.
- **Data Lake Storage:** Amazon S3. Highly durable storage for raw JSON/Parquet files.
- **Data Warehouse:** Amazon Redshift Serverless. Chosen for its native integration with S3 (Redshift Spectrum) and seamless auto-scaling for analytical queries.
- **Message Broker:** Amazon MSK (Managed Streaming for Apache Kafka). Handles real-time event streaming.
- **Caching:** Amazon ElastiCache (Redis). Caches complex analytical queries (e.g., Neighbourhood Price Index) before serving to the frontend.
- **Orchestration:** Amazon MWAA (Managed Workflows for Apache Airflow). Schedules and orchestrates the ELT pipelines.

## 3. Security
- **VPC Isolation:** All compute and data services reside in private subnets. Only the Application Load Balancer is exposed to the public internet.
- **IAM:** Strict least-privilege IAM roles for EKS pods (IRSA).
- **Encryption:** KMS encryption at rest for S3, Redshift, and MSK. TLS in transit.
