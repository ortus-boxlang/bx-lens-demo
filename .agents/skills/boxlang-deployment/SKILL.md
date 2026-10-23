---
name: boxlang-deployment
description: "Use this skill when deploying BoxLang applications: CommandBox server setup, Docker containers, serverless (AWS Lambda, Google Cloud Functions, Azure Functions - see their dedicated runtime-* skills), GitHub Actions CI/CD, BoxLang Version Manager (BVM), boxlang.json runtime config, environment variables, or Spring Boot integration."
---

# BoxLang Deployment

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

BoxLang applications can be deployed across multiple runtimes: embedded web servers
(CommandBox/MiniServer), Docker containers, serverless (AWS Lambda, Google Cloud
Functions, Azure), Spring Boot, and even WASM. JRE 21+ is required for all deployments.

## Requirements

- **JRE 21+** (or OpenJDK 21+) is required
- **CommandBox** is the recommended deployment tool for traditional servers
- **BVM** (BoxLang Version Manager) manages BoxLang versions per project

---

## CommandBox (Recommended for Traditional Servers)

### Installation

```bash
# Install CommandBox (macOS)
brew install commandbox

# Linux
curl -fsSl https://downloads.ortussolutions.com/debs/gpg | apt-key add -
echo "deb https://downloads.ortussolutions.com/debs/noarch /" >> /etc/apt/sources.list.d/commandbox.list
apt-get install commandbox

# Install BoxLang engine in CommandBox
box install commandbox-boxlang
```

### Start a Server

```bash
# Simple start
box server start cfengine=boxlang javaVersion=openjdk21_jdk

# With port
box server start cfengine=boxlang port=8080

# Start with server.json
box server start
```

### `server.json` Configuration

```json
{
    "name": "myapp-production",
    "web": {
        "http": {
            "port": 8080,
            "enable": true
        },
        "https": {
            "port": 8443,
            "enable": true,
            "certFile": "/certs/myapp.crt",
            "keyFile": "/certs/myapp.key"
        },
        "webroot": "www",
        "rewrites": {
            "enable": true
        }
    },
    "app": {
        "cfengine": "boxlang",
        "javaVersion": "openjdk21_jdk",
        "WARPath": ""
    },
    "jvm": {
        "heapSize": "512m",
        "maxHeapSize": "2048m",
        "args": "-Duser.timezone=UTC -Dfile.encoding=UTF-8"
    },
    "env": {
        "DB_HOST": "${DB_HOST:localhost}",
        "DB_NAME": "${DB_NAME:myapp}",
        "APP_ENV": "production"
    },
    "runwar": {
        "args": "--timeout 120"
    }
}
```

### Server Management

```bash
box server start    # Start
box server stop     # Stop
box server restart  # Restart
box server status   # Show status
box server log      # Tail logs
box server open     # Open in browser
```

---

## Docker

### Dockerfile

```dockerfile
FROM ortussolutions/boxlang:latest

# Set working directory
WORKDIR /app

# Copy application files
COPY box.json .
COPY server.json .
COPY www/ ./www/
COPY boxlang.json .

# Install dependencies
RUN box install --production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the server
CMD ["box", "server", "start", "--console"]
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
      DB_NAME: myapp
      DB_USER: ${DB_USER}
      DB_PASS: ${DB_PASS}
      REDIS_HOST: redis
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: myapp
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASS}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASS}
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
```

### Build and Run

```bash
docker build -t myapp:latest .
docker run -p 8080:8080 --env-file .env myapp:latest

# docker-compose
docker-compose up -d
docker-compose logs -f app
docker-compose down
```

---

## Serverless (AWS Lambda, Google Cloud Functions, Azure Functions)

BoxLang ships a dedicated pre-built runtime for each of the three major
serverless providers - `LambdaRunner`, `FunctionRunner`, and
`AzureFunctionRunner` respectively. All three are structural mirrors of each
other: the same `handlers/` directory routing convention, the same
`manifest.json` build-time routing table (with `reserved`/`defaultHandler`
enforcement), the same `run( event, context, response )` handler contract,
and the same `x-bx-function` header for calling an alternate method. `.bx`
handler code moves between all three providers unmodified - only the
deployment step differs.

Each has its own starter template (Gradle build, `Application.bx`/`Lambda.bx`
scaffold, local dev server, deploy scripts/plugin) and its own dedicated
skill with full routing, configuration, and deployment details - use those
skills instead of this one for anything serverless-specific:

- **AWS Lambda** - `runtime-aws-lambda` skill · [boxlang-starter-aws-lambda](https://github.com/ortus-boxlang/boxlang-starter-aws-lambda)
- **Google Cloud Functions** - `runtime-google-cloud-functions` skill · [boxlang-starter-google-functions](https://github.com/ortus-boxlang/boxlang-starter-google-functions)
- **Azure Functions** - `runtime-azure-functions` skill · [boxlang-starter-azure-functions](https://github.com/ortus-boxlang/boxlang-starter-azure-functions)

Minimal handler shape, identical across all three runtimes:

```boxlang
// src/main/bx/Lambda.bx - the default handler
class {
    function run( event, context, response ){
        return { "message": "Hello from BoxLang!" }
    }
}
```

Add routed handlers under `src/main/bx/handlers/` (e.g. `handlers/Products.bx`
serves `/products`); `./gradlew generateManifest` regenerates the routing
`manifest.json` from that directory on every build.

---

## BoxLang Version Manager (BVM)

```bash
# Install BVM
curl -fsSl https://downloads.ortussolutions.com/bvm/install.sh | bash

# List available versions
bvm list

# Install a specific version
bvm install 1.12.0

# Use a version for current project
bvm use 1.12.0

# Set global default
bvm default 1.12.0

# Show current version
bvm current

# Quick installer (one-line)
curl -fsSl https://downloads.ortussolutions.com/boxlang/install.sh | bash
```

---

## Runtime Configuration (`boxlang.json`)

```json
{
    "debugMode": false,
    "timezone": "UTC",
    "locale": "en_US",
    "charset": {
        "web": "UTF-8",
        "resource": "UTF-8",
        "template": "UTF-8"
    },
    "logging": {
        "level": "WARN",
        "appenders": {
            "console": {
                "type": "ConsoleAppender",
                "layout": "PatternLayout",
                "pattern": "%d{ISO8601} %-5p [%t] %c: %m%n"
            },
            "file": {
                "type": "RollingFileAppender",
                "fileName": "logs/boxlang.log",
                "maxFileSize": "10MB",
                "maxBackupIndex": 5
            }
        }
    },
    "executors": {
        "io-tasks": {
            "type": "virtual",
            "description": "Unlimited IO bound tasks using Java Virtual Threads"
        },
        "cpu-tasks": {
            "type": "scheduled",
            "threads": 20,
            "description": "CPU bound tasks using a fixed thread pool with scheduling"
        },
        "scheduled-tasks": {
            "type": "scheduled",
            "threads": 20,
            "description": "Scheduled tasks using a fixed thread pool"
        }
    },
    "datasources": {
        "mainDB": {
            "driver": "mysql",
            "host": "${DB_HOST:localhost}",
            "port": 3306,
            "database": "${DB_NAME}",
            "username": "${DB_USER}",
            "password": "${DB_PASS}"
        }
    },
    "caches": {
        "default": {
            "provider": "BoxCacheProvider",
            "properties": {
                "maxObjects": 5000,
                "defaultTimeout": 60
            }
        }
    }
}
```

### Environment Variable Overrides

Any `boxlang.json` setting can be overridden via system properties:

```bash
# Override debug mode
java -Dboxlang.debugMode=true -jar boxlang.jar

# Override datasource
java -Dboxlang.datasources.mainDB.host=prod-db.example.com -jar boxlang.jar
```

---

## GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Test and Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Java 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Install CommandBox
        uses: ortus-solutions/setup-commandbox@v2

      - name: Install dependencies
        run: box install

      - name: Run tests
        run: box testbox run

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Push to ECR
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws ecr get-login-password --region us-east-1 | \
            docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
          docker push ${{ secrets.ECR_REGISTRY }}/myapp:${{ github.sha }}
```

---

## Spring Boot Integration

```java
// Java: embed BoxLang in a Spring Boot application
@SpringBootApplication
public class MyApp {
    @Bean
    public BoxRuntime boxRuntime() {
        return BoxRuntime.getInstance();
    }
}
```

```boxlang
// BoxLang handler called from Spring
class {
    function handleSpringRequest( httpServletRequest, httpServletResponse ) {
        // Process Spring MVC request
    }
}
```

---

## Homebrew (macOS)

```bash
brew tap ortus-solutions/tap
brew install boxlang

# Run a script
boxlang script.bxs

# Start MiniServer
boxlang-miniserver
```

## References

- [Running BoxLang](https://boxlang.ortusbooks.com/getting-started/running-boxlang)
- [CommandBox](https://boxlang.ortusbooks.com/getting-started/running-boxlang/commandbox)
- [Docker](https://boxlang.ortusbooks.com/getting-started/running-boxlang/docker)
- [AWS Lambda](https://boxlang.ortusbooks.com/getting-started/running-boxlang/aws-lambda)
- [Google Cloud Functions](https://boxlang.ortusbooks.com/getting-started/running-boxlang/google-cloud-functions)
- [Azure Functions](https://boxlang.ortusbooks.com/getting-started/running-boxlang/azure-functions)
- [GitHub Actions](https://boxlang.ortusbooks.com/getting-started/running-boxlang/github-actions)
- [BVM](https://boxlang.ortusbooks.com/getting-started/installation/bvm)
- [boxlang.json](https://boxlang.ortusbooks.com/getting-started/configuration)
